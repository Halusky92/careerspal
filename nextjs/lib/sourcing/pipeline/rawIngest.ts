import type { SupabaseClient } from "@supabase/supabase-js";
import { rawHashDecision } from "../freshness";

type AdminSb = SupabaseClient<any, "public", any>;

export type RawJobRow = {
  source_id: string;
  source_run_id: string | null;
  source_type: string;
  source_url: string;
  external_job_id: string;
  job_url: string | null;
  title: string | null;
  raw_payload: unknown;
  payload_hash: string;
  fetched_at: string;
  last_seen_at?: string;
};

export async function upsertRawJobsByHash(sb: AdminSb, rows: RawJobRow[]) {
  const now = new Date().toISOString();
  if (rows.length === 0) {
    return { inserted: 0, updated: 0, unchanged: 0 };
  }

  const sourceId = rows[0].source_id;
  const externalIds = Array.from(new Set(rows.map((row) => row.external_job_id)));
  const existing = new Map<string, { id: string; payload_hash: string | null }>();

  for (let i = 0; i < externalIds.length; i += 100) {
    const chunk = externalIds.slice(i, i + 100);
    const { data } = await sb
      .from("sourcing_sourced_jobs_raw")
      .select("id,external_job_id,payload_hash")
      .eq("source_id", sourceId)
      .in("external_job_id", chunk);
    for (const row of (data as Array<{ id: string; external_job_id: string; payload_hash: string | null }> | null) || []) {
      existing.set(String(row.external_job_id), { id: row.id, payload_hash: row.payload_hash });
    }
  }

  const changed: RawJobRow[] = [];
  const unchangedIds: string[] = [];
  let inserted = 0;
  let updated = 0;

  for (const row of rows) {
    const payload = { ...row, last_seen_at: now };
    const prev = existing.get(row.external_job_id);
    const decision = rawHashDecision(prev?.payload_hash, row.payload_hash);
    if (decision === "unchanged" && prev?.id) {
      unchangedIds.push(prev.id);
      continue;
    }
    if (decision === "insert") inserted += 1;
    else updated += 1;
    changed.push(payload);
  }

  if (changed.length > 0) {
    let { error } = await sb.from("sourcing_sourced_jobs_raw").upsert(changed, {
      onConflict: "source_id,external_job_id",
    });
    if (error && /last_seen_at/i.test(error.message || "")) {
      const stripped = changed.map(({ last_seen_at: _last, ...row }) => row);
      const retry = await sb.from("sourcing_sourced_jobs_raw").upsert(stripped, {
        onConflict: "source_id,external_job_id",
      });
      error = retry.error;
    }
    if (error) throw new Error("Raw upsert failed.");
  }

  if (unchangedIds.length > 0) {
    for (let i = 0; i < unchangedIds.length; i += 100) {
      const chunk = unchangedIds.slice(i, i + 100);
      const seen = await sb.from("sourcing_sourced_jobs_raw").update({ last_seen_at: now }).in("id", chunk);
      if (seen.error && /last_seen_at/i.test(seen.error.message || "")) break;
    }
  }

  return { inserted, updated, unchanged: unchangedIds.length };
}
