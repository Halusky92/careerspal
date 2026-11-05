import type { SupabaseClient } from "@supabase/supabase-js";

const SOURCING_KEEP_DAYS = 30;

export type PurgeSourcingDebrisResult = {
  rawDeleted: number;
  candidatesDeleted: number;
  dryRun: boolean;
  days: number;
};

export async function purgeSourcingDebris(
  sb: SupabaseClient<any, "public", any>,
  opts?: { dryRun?: boolean; days?: number },
): Promise<PurgeSourcingDebrisResult> {
  const days = opts?.days && opts.days > 0 ? opts.days : SOURCING_KEEP_DAYS;
  const dryRun = Boolean(opts?.dryRun);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await sb.from("sourcing_sourced_jobs_raw").select("id").lt("fetched_at", cutoff).limit(500);
  const ids = error ? [] : ((data || []) as Array<{ id: string }>).map((row) => row.id);
  if (!dryRun && ids.length > 0) {
    await sb.from("sourcing_sourced_jobs_raw").delete().in("id", ids);
  }

  const candidates = await sb
    .from("sourcing_sourced_job_candidates")
    .select("id")
    .lt("created_at", cutoff)
    .in("publish_status", ["skipped_not_eligible", "failed", "auto_published"])
    .limit(500);
  const candidateIds = candidates.error ? [] : ((candidates.data || []) as Array<{ id: string }>).map((row) => row.id);
  if (!dryRun && candidateIds.length > 0) {
    await sb.from("sourcing_sourced_job_candidates").delete().in("id", candidateIds);
  }

  return { rawDeleted: ids.length, candidatesDeleted: candidateIds.length, dryRun, days };
}

export async function purgeSourcingDebrisUntilEmpty(
  sb: SupabaseClient<any, "public", any>,
  opts?: { dryRun?: boolean; days?: number },
) {
  let rawDeleted = 0;
  let candidatesDeleted = 0;
  for (let i = 0; i < 20; i += 1) {
    const slice = await purgeSourcingDebris(sb, opts);
    rawDeleted += slice.rawDeleted;
    candidatesDeleted += slice.candidatesDeleted;
    if (slice.rawDeleted === 0 && slice.candidatesDeleted === 0) break;
    if (opts?.dryRun) break;
  }
  return { rawDeleted, candidatesDeleted, dryRun: Boolean(opts?.dryRun), days: opts?.days || 30 };
}
