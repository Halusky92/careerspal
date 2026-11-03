import type { SupabaseClient } from "@supabase/supabase-js";

/** Listing lifespan used by Indeed / most job boards. */
export const STALE_JOB_DAYS = 30;

const ARCHIVE_STATUSES = new Set(["published", "paused", "closed", "private", "invite_only"]);
const DELETE_STATUSES = new Set(["draft"]);

type StaleJobRow = {
  id: string;
  status: string | null;
  timestamp: number | null;
  created_at?: string | null;
  published_at?: string | null;
};

export type ExpireStaleJobsResult = {
  scanned: number;
  archived: number;
  deletedDrafts: number;
  skipped: number;
  dryRun: boolean;
  days: number;
};

function ageMs(row: StaleJobRow, now: number): number | null {
  if (typeof row.timestamp === "number" && Number.isFinite(row.timestamp) && row.timestamp > 0) {
    const ts = row.timestamp < 1e12 ? row.timestamp * 1000 : row.timestamp;
    return now - ts;
  }
  for (const iso of [row.published_at, row.created_at]) {
    if (!iso) continue;
    const t = Date.parse(iso);
    if (Number.isFinite(t)) return now - t;
  }
  return null;
}

export async function expireStaleJobs(
  sb: SupabaseClient<any, "public", any>,
  opts?: { dryRun?: boolean; days?: number },
): Promise<ExpireStaleJobsResult> {
  const days = opts?.days && opts.days > 0 ? opts.days : STALE_JOB_DAYS;
  const dryRun = Boolean(opts?.dryRun);
  const now = Date.now();
  const cutoffMs = days * 24 * 60 * 60 * 1000;

  const pageSize = 200;
  let offset = 0;
  const stale: StaleJobRow[] = [];
  let scanned = 0;
  let skipped = 0;

  while (true) {
    const { data, error } = await sb
      .from("jobs")
      .select("id,status,timestamp,created_at,published_at")
      .in("status", ["draft", "published", "paused", "closed", "private", "invite_only"])
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = (data || []) as StaleJobRow[];
    if (rows.length === 0) break;
    scanned += rows.length;
    for (const row of rows) {
      const age = ageMs(row, now);
      if (age == null || age < cutoffMs) {
        skipped += 1;
        continue;
      }
      stale.push(row);
    }
    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  const toArchive = stale.filter((row) => ARCHIVE_STATUSES.has(row.status || "")).map((row) => row.id);
  const toDelete = stale.filter((row) => DELETE_STATUSES.has(row.status || "")).map((row) => row.id);

  if (!dryRun) {
    for (let i = 0; i < toArchive.length; i += 100) {
      const chunk = toArchive.slice(i, i + 100);
      const payload: Record<string, unknown> = {
        status: "archived",
        posted_at_text: "Archived",
        unpublished_at: new Date().toISOString(),
      };
      let { error } = await sb.from("jobs").update(payload).in("id", chunk);
      if (error) {
        const { unpublished_at: _unpublished, ...without } = payload;
        const retry = await sb.from("jobs").update(without).in("id", chunk);
        error = retry.error;
      }
      if (error) throw new Error(error.message);
    }
    for (let i = 0; i < toDelete.length; i += 100) {
      const chunk = toDelete.slice(i, i + 100);
      const { error } = await sb.from("jobs").delete().eq("status", "draft").in("id", chunk);
      if (error) throw new Error(error.message);
    }
  }

  return {
    scanned,
    archived: toArchive.length,
    deletedDrafts: toDelete.length,
    skipped,
    dryRun,
    days,
  };
}
