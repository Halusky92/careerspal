import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../../../lib/supabaseServerAuth";
import { normalizeGreenhouseRawPayload } from "../../../../../../lib/sourcing/normalization/greenhouse";

export const runtime = "nodejs";

type RawRow = {
  id: string;
  source_id: string;
  source_run_id: string | null;
  source_type: string;
  source_url: string;
  external_job_id: string;
  job_url: string | null;
  title: string | null;
  raw_payload: unknown;
  payload_hash: string | null;
};

export async function POST(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as { sourceId?: string; runId?: string; limit?: number };
  const sourceId = (body.sourceId || "").trim();
  const runId = (body.runId || "").trim();
  const limit = Math.min(500, Math.max(1, Number(body.limit) || 200));

  let q = supabaseAdmin
    .from("sourcing_sourced_jobs_raw")
    .select("id,source_id,source_run_id,source_type,source_url,external_job_id,job_url,title,raw_payload,payload_hash")
    .eq("source_type", "greenhouse")
    .order("fetched_at", { ascending: false })
    .limit(limit);

  if (sourceId) q = q.eq("source_id", sourceId);
  if (runId) q = q.eq("source_run_id", runId);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: "Unable to load raw jobs." }, { status: 500 });
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const errors: Array<{ rawId: string; error: string }> = [];

  for (const row of (data as RawRow[] | null) || []) {
    try {
      // Idempotency: if candidate exists with same payload_hash, skip.
      const { data: existing } = await supabaseAdmin
        .from("sourcing_sourced_job_candidates")
        .select("id,payload_hash")
        .eq("raw_job_id", row.id)
        .maybeSingle();

      if (existing?.id && existing.payload_hash && row.payload_hash && existing.payload_hash === row.payload_hash) {
        skipped += 1;
        continue;
      }

      const normalized = normalizeGreenhouseRawPayload({
        sourceUrl: row.source_url,
        externalJobId: row.external_job_id,
        companyName: null,
        rawPayload: row.raw_payload,
      });

      const upsertRow = {
        raw_job_id: row.id,
        source_id: row.source_id,
        source_run_id: row.source_run_id,
        source_type: "greenhouse",
        source_url: row.source_url,
        external_job_id: row.external_job_id,
        job_url: normalized.job_url,
        apply_url: normalized.apply_url,
        title: normalized.title,
        company_name: normalized.company_name,
        location_text: normalized.location_text,
        remote_policy: normalized.remote_policy,
        posted_at: normalized.posted_at,
        description_raw: normalized.description_raw,
        description_clean: normalized.description_clean,
        salary_text_raw: normalized.salary_text_raw,
        salary_amount_min: normalized.salary_amount_min,
        salary_amount_max: normalized.salary_amount_max,
        salary_currency: normalized.salary_currency,
        salary_period: normalized.salary_period,
        salary_present: normalized.salary_present,
        salary_confidence: normalized.salary_confidence,
        salary_detected_from: normalized.salary_detected_from,
        payload_hash: row.payload_hash,
        provenance: normalized.provenance,
      };

      const { data: upserted, error: upErr } = await supabaseAdmin
        .from("sourcing_sourced_job_candidates")
        .upsert(upsertRow, { onConflict: "raw_job_id" })
        .select("id")
        .single();

      if (upErr || !upserted) throw new Error("Upsert failed.");

      if (existing?.id) updated += 1;
      else inserted += 1;
    } catch (e) {
      errors.push({ rawId: row.id, error: e instanceof Error ? e.message : "Normalization failed" });
    }
  }

  // Optional: update run counters when runId is provided.
  if (runId) {
    await supabaseAdmin
      .from("sourcing_source_runs")
      .update({
        new_candidates_count: inserted + updated,
        error_summary: errors.length > 0 ? `Normalization errors: ${errors.length}` : null,
      })
      .eq("id", runId);
  }

  return NextResponse.json({ processed: (data || []).length, inserted, updated, skipped, errors: errors.slice(0, 20) });
}

