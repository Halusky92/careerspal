import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../../lib/supabaseServerAuth";
import { scoreCandidate } from "../../../../../lib/sourcing/evaluation/scoring";
import { dedupeAgainst, type CandidateForDedupe } from "../../../../../lib/sourcing/evaluation/dedupe";
import { prepareDecision } from "../../../../../lib/sourcing/evaluation/decision";

export const runtime = "nodejs";

type CandidateRow = {
  id: string;
  source_id: string;
  source_run_id: string | null;
  source_type: string;
  source_url: string;
  external_job_id: string;
  job_url: string | null;
  apply_url: string | null;
  title: string | null;
  company_name: string | null;
  location_text: string | null;
  remote_policy: string | null;
  description_clean: string | null;
  salary_present: boolean;
};

type SourceRow = { id: string; validation_state: string; enabled: boolean; source_type: string };

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
    .from("sourcing_sourced_job_candidates")
    .select(
      "id,source_id,source_run_id,source_type,source_url,external_job_id,job_url,apply_url,title,company_name,location_text,remote_policy,description_clean,salary_present",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (sourceId) q = q.eq("source_id", sourceId);
  if (runId) q = q.eq("source_run_id", runId);

  const { data: candidates, error: candErr } = await q;
  if (candErr) {
    return NextResponse.json({ error: "Unable to load candidates." }, { status: 500 });
  }

  const candidateRows = (candidates as CandidateRow[] | null) || [];
  if (candidateRows.length === 0) return NextResponse.json({ processed: 0, evaluated: 0 });

  // Preload sources for trust inputs.
  const sourceIds = Array.from(new Set(candidateRows.map((c) => c.source_id)));
  const { data: sources } = await supabaseAdmin
    .from("sourcing_sources")
    .select("id,validation_state,enabled,source_type")
    .in("id", sourceIds);
  const sourceMap = new Map<string, SourceRow>();
  (sources as SourceRow[] | null || []).forEach((s) => sourceMap.set(s.id, s));

  // Preload candidates for dedupe comparisons (within the batch).
  const batchForDedupe: CandidateForDedupe[] = candidateRows.map((c) => ({
    id: c.id,
    title: c.title,
    company_name: c.company_name,
    apply_url: c.apply_url,
    job_url: c.job_url,
  }));

  // Preload apply_url matches against published jobs (conservative).
  const applyUrls = Array.from(
    new Set(
      candidateRows
        .map((c) => (c.apply_url || c.job_url || "").trim())
        .filter(Boolean)
        .map((u) => u.toLowerCase()),
    ),
  ).slice(0, 500);
  const jobsByApplyUrl = new Map<string, string>();
  if (applyUrls.length > 0) {
    const { data: jobs } = await supabaseAdmin.from("jobs").select("id,apply_url").in("apply_url", applyUrls);
    (jobs as any[] | null || []).forEach((j) => {
      const key = ((j.apply_url || "") as string).trim().toLowerCase();
      if (key) jobsByApplyUrl.set(key, (j.id as string) || "");
    });
  }

  let evaluated = 0;
  const errors: Array<{ candidateId: string; error: string }> = [];

  for (const c of candidateRows) {
    try {
      const src = sourceMap.get(c.source_id);
      const scoring = scoreCandidate({
        title: c.title,
        company_name: c.company_name,
        apply_url: c.apply_url,
        job_url: c.job_url,
        location_text: c.location_text,
        remote_policy: c.remote_policy,
        description_clean: c.description_clean,
        salary_present: Boolean(c.salary_present),
        source_type: c.source_type,
        source_validation_state: src?.validation_state || null,
        source_enabled: typeof src?.enabled === "boolean" ? src.enabled : null,
      });

      const dd = dedupeAgainst(
        { id: c.id, title: c.title, company_name: c.company_name, apply_url: c.apply_url, job_url: c.job_url },
        batchForDedupe,
        jobsByApplyUrl,
      );

      const decision = prepareDecision({
        score_total: scoring.total,
        reasons: scoring.reasons,
        salary_present: Boolean(c.salary_present),
        duplicate_confidence: dd.confidence,
      });

      await supabaseAdmin
        .from("sourcing_candidate_scores")
        .upsert(
          {
            candidate_id: c.id,
            model_version: "v1",
            score_total: scoring.total,
            score_breakdown: scoring.breakdown,
            reason_codes: scoring.reasons,
            computed_at: new Date().toISOString(),
          },
          { onConflict: "candidate_id" },
        );

      await supabaseAdmin
        .from("sourcing_candidate_dedupes")
        .upsert(
          {
            candidate_id: c.id,
            confidence: dd.confidence,
            duplicate_of_candidate_id: dd.duplicateOfCandidateId,
            duplicate_of_job_id: dd.duplicateOfJobId,
            signals: dd.signals,
            computed_at: new Date().toISOString(),
          },
          { onConflict: "candidate_id" },
        );

      await supabaseAdmin
        .from("sourcing_candidate_decisions")
        .upsert(
          {
            candidate_id: c.id,
            policy_version: "v1",
            decision: decision.decision,
            score_total: scoring.total,
            blocking_reason_codes: decision.blocking,
            warning_reason_codes: decision.warnings,
            info_reason_codes: decision.info,
            computed_at: new Date().toISOString(),
          },
          { onConflict: "candidate_id" },
        );

      evaluated += 1;
    } catch (e) {
      errors.push({ candidateId: c.id, error: e instanceof Error ? e.message : "Evaluation failed" });
    }
  }

  return NextResponse.json({ processed: candidateRows.length, evaluated, errors: errors.slice(0, 20) });
}

