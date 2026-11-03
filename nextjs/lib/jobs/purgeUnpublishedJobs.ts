import type { SupabaseClient } from "@supabase/supabase-js";
import {
  UNPUBLISHED_PURGE_STATUSES,
  UNPUBLISHED_RETENTION_DAYS,
  unpublishedAgeMs,
  type UnpublishedAgeRow,
} from "./unpublishedRetention";

type PurgeRow = UnpublishedAgeRow & { id: string };

export type PurgeUnpublishedJobsResult = {
  scanned: number;
  deleted: number;
  skipped: number;
  dryRun: boolean;
  days: number;
};

export async function purgeUnpublishedJobs(
  sb: SupabaseClient<any, "public", any>,
  opts?: { dryRun?: boolean; days?: number },
): Promise<PurgeUnpublishedJobsResult> {
  const days = opts?.days && opts.days > 0 ? opts.days : UNPUBLISHED_RETENTION_DAYS;
  const dryRun = Boolean(opts?.dryRun);
  const now = Date.now();
  const cutoffMs = days * 24 * 60 * 60 * 1000;

  const pageSize = 200;
  let offset = 0;
  const toDelete: string[] = [];
  let scanned = 0;
  let skipped = 0;
  let select = "id,status,timestamp,created_at,published_at,unpublished_at";
  let triedWithoutUnpublished = false;

  while (true) {
    let { data, error } = await sb
      .from("jobs")
      .select(select)
      .in("status", [...UNPUBLISHED_PURGE_STATUSES])
      .range(offset, offset + pageSize - 1);
    if (error && !triedWithoutUnpublished) {
      triedWithoutUnpublished = true;
      select = "id,status,timestamp,created_at,published_at";
      offset = 0;
      continue;
    }
    if (error) throw new Error(error.message);
    const rows = (data || []) as PurgeRow[];
    if (rows.length === 0) break;
    scanned += rows.length;
    for (const row of rows) {
      const age = unpublishedAgeMs(row, now);
      if (age == null || age < cutoffMs) {
        skipped += 1;
        continue;
      }
      toDelete.push(row.id);
    }
    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  if (!dryRun && toDelete.length > 0) {
    for (let i = 0; i < toDelete.length; i += 100) {
      const chunk = toDelete.slice(i, i + 100);
      const { error } = await sb.from("jobs").delete().in("id", chunk).neq("status", "published");
      if (error) throw new Error(error.message);
    }
    await sb.from("audit_logs").insert({
      action: "unpublished_jobs_purged",
      metadata: { deleted: toDelete.length, days, jobIds: toDelete.slice(0, 50) },
    });
  }

  return {
    scanned,
    deleted: toDelete.length,
    skipped,
    dryRun,
    days,
  };
}
