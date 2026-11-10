import type { SupabaseClient } from "@supabase/supabase-js";
import { isSourcedListing } from "./applyLinkHealth";
import { shouldExpireSourcedByAge } from "../sourcing/freshness";

/** Listing lifespan used by Indeed / most job boards. */
export const STALE_JOB_DAYS = 30;

const ARCHIVE_STATUSES = new Set(["published", "paused", "closed", "private", "invite_only"]);
const DELETE_STATUSES = new Set(["draft"]);

type StaleJobRow = {
  id: string;
  status: string | null;
  origin?: string | null;
  apply_url?: string | null;
  plan_price?: number | null;
  stripe_payment_status?: string | null;
  timestamp: number | null;
  created_at?: string | null;
  published_at?: string | null;
  last_seen_at?: string | null;
};

export type ExpireStaleJobsResult = {
  scanned: number;
  archived: number;
  deletedDrafts: number;
  deletedSourced: number;
  skipped: number;
  dryRun: boolean;
  days: number;
};

async function loadSourcedJobIds(sb: SupabaseClient<any, "public", any>) {
  const ids = new Set<string>();
  let offset = 0;
  const pageSize = 500;
  while (true) {
    const { data, error } = await sb
      .from("sourcing_sourced_job_candidates")
      .select("published_job_id")
      .not("published_job_id", "is", null)
      .range(offset, offset + pageSize - 1);
    if (error) break;
    const rows = (data || []) as Array<{ published_job_id: string | null }>;
    if (rows.length === 0) break;
    for (const row of rows) {
      if (row.published_job_id) ids.add(row.published_job_id);
    }
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return ids;
}

function isPaidEmployerListing(row: StaleJobRow) {
  if (isSourcedListing(row)) return false;
  return (typeof row.plan_price === "number" && row.plan_price > 0) || row.stripe_payment_status === "paid";
}

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
    const first = await sb
      .from("jobs")
      .select("id,status,origin,apply_url,plan_price,stripe_payment_status,timestamp,created_at,published_at,last_seen_at")
      .in("status", ["draft", "published", "paused", "closed", "private", "invite_only", "archived"])
      .range(offset, offset + pageSize - 1);
    const page = first.error
      ? await sb
          .from("jobs")
          .select("id,status,apply_url,plan_price,stripe_payment_status,timestamp,created_at,published_at")
          .in("status", ["draft", "published", "paused", "closed", "private", "invite_only", "archived"])
          .range(offset, offset + pageSize - 1)
      : first;
    if (page.error) throw new Error(page.error.message);
    const rows = (page.data || []) as StaleJobRow[];
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

  const sourcedJobIds = await loadSourcedJobIds(sb);
  const sourcedStale = stale.filter((row) => isSourcedListing({ ...row, sourcedJobIds }));
  const employerStale = stale.filter((row) => !isSourcedListing({ ...row, sourcedJobIds }) && !isPaidEmployerListing(row));
  const toArchive = employerStale.filter((row) => ARCHIVE_STATUSES.has(row.status || "")).map((row) => row.id);
  const toDeleteDrafts = employerStale.filter((row) => DELETE_STATUSES.has(row.status || "")).map((row) => row.id);
  const toDeleteSourced = sourcedStale
    .filter((row) => shouldExpireSourcedByAge({ lastSeenAt: row.last_seen_at, confirmedRemoved: false }))
    .map((row) => row.id);

  if (!dryRun) {
    for (let i = 0; i < toDeleteSourced.length; i += 100) {
      const chunk = toDeleteSourced.slice(i, i + 100);
      const { error } = await sb.from("jobs").delete().in("id", chunk);
      if (error) throw new Error(error.message);
    }
    if (toDeleteSourced.length > 0) {
      try {
        await sb.from("audit_logs").insert({
          action: "sourced_jobs_expired",
          metadata: { deleted: toDeleteSourced.length, days, jobIds: toDeleteSourced.slice(0, 50) },
        });
      } catch {
        // audit table is optional
      }
    }
    for (let i = 0; i < toDeleteDrafts.length; i += 100) {
      const chunk = toDeleteDrafts.slice(i, i + 100);
      const { error } = await sb.from("jobs").delete().eq("status", "draft").in("id", chunk);
      if (error) throw new Error(error.message);
    }
    for (let i = 0; i < toArchive.length; i += 100) {
      const chunk = toArchive.slice(i, i + 100);
      const payload: Record<string, unknown> = {
        status: "archived",
        posted_at_text: "Archived",
        unpublished_at: new Date().toISOString(),
      };
      let { error } = await sb.from("jobs").update(payload).in("id", chunk);
      if (error) {
        const closed = await sb
          .from("jobs")
          .update({ status: "closed", posted_at_text: "Archived", unpublished_at: new Date().toISOString() })
          .in("id", chunk);
        error = closed.error;
      }
      if (error) {
        const paused = await sb.from("jobs").update({ status: "paused", posted_at_text: "Archived" }).in("id", chunk);
        error = paused.error;
      }
      if (error) throw new Error(error.message);
    }
  }

  return {
    scanned,
    archived: toArchive.length,
    deletedDrafts: toDeleteDrafts.length,
    deletedSourced: toDeleteSourced.length,
    skipped,
    dryRun,
    days,
  };
}
