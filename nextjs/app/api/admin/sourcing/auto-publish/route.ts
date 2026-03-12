import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../../lib/supabaseServerAuth";

export const runtime = "nodejs";

const AUTO_PUBLISH_MIN_SCORE = Math.min(
  100,
  Math.max(0, Number.parseInt(process.env.SOURCING_AUTO_PUBLISH_SCORE || "85", 10) || 85),
);

const SUPPORTED_SOURCE_TYPES = new Set<string>(
  (process.env.SOURCING_AUTO_PUBLISH_SOURCES || "greenhouse")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);

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
  posted_at: string | null;
  description_clean: string | null;
  salary_text_raw: string | null;
  salary_amount_min: number | null;
  salary_amount_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  salary_present: boolean;
  published_job_id: string | null;
  publish_status: string;
};

type SourceRow = {
  id: string;
  company_id: string | null;
  enabled: boolean;
  validation_state: string;
  source_type: string;
  display_name: string | null;
  companies?: { id: string; name: string; website: string | null; logo_url: string | null; slug: string | null } | null;
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
  const limit = Math.min(300, Math.max(1, Number(body.limit) || 100));

  // Load eligible candidates based on decision prep.
  let q = supabaseAdmin
    .from("sourcing_sourced_job_candidates")
    .select(
      "id,source_id,source_run_id,source_type,source_url,external_job_id,job_url,apply_url,title,company_name,location_text,remote_policy,posted_at,description_clean,salary_text_raw,salary_amount_min,salary_amount_max,salary_currency,salary_period,salary_present,published_job_id,publish_status," +
        "sourcing_candidate_scores(score_total)," +
        "sourcing_candidate_dedupes(confidence,duplicate_of_job_id)," +
        "sourcing_candidate_decisions(decision,blocking_reason_codes,warning_reason_codes)",
    )
    .is("published_job_id", null)
    .eq("publish_status", "not_published")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (sourceId) q = q.eq("source_id", sourceId);
  if (runId) q = q.eq("source_run_id", runId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: "Unable to load candidates." }, { status: 500 });

  const rows = (data as any[] | null) || [];
  if (rows.length === 0) {
    return NextResponse.json({ processed: 0, published: 0, skipped: 0, failed: 0, minScore: AUTO_PUBLISH_MIN_SCORE });
  }

  // Preload sources (approval/enabled/company context).
  const sourceIds = Array.from(new Set(rows.map((r) => r.source_id)));
  const { data: sources } = await supabaseAdmin
    .from("sourcing_sources")
    .select("id,company_id,enabled,validation_state,source_type,display_name,companies(id,name,website,logo_url,slug)")
    .in("id", sourceIds);
  const sourceMap = new Map<string, SourceRow>();
  (sources as any[] | null || []).forEach((s) => sourceMap.set(s.id, s as SourceRow));

  let published = 0;
  let skipped = 0;
  let failed = 0;
  const results: any[] = [];

  for (const r of rows) {
    const candidate = r as CandidateRow & {
      sourcing_candidate_scores?: { score_total?: number } | null;
      sourcing_candidate_dedupes?: { confidence?: string; duplicate_of_job_id?: string | null } | null;
      sourcing_candidate_decisions?: { decision?: string; blocking_reason_codes?: any[]; warning_reason_codes?: any[] } | null;
    };

    const src = sourceMap.get(candidate.source_id);
    const scoreTotal = Number(candidate.sourcing_candidate_scores?.score_total ?? 0);
    const decision = candidate.sourcing_candidate_decisions?.decision || null;
    const blocking = (candidate.sourcing_candidate_decisions?.blocking_reason_codes as string[] | undefined) || [];
    const dupConfidence = (candidate.sourcing_candidate_dedupes?.confidence || "none").toString();

    const eligible =
      decision === "auto_publish_candidate" &&
      scoreTotal >= AUTO_PUBLISH_MIN_SCORE &&
      candidate.salary_present === true &&
      dupConfidence !== "high" &&
      blocking.length === 0 &&
      Boolean(candidate.apply_url && candidate.apply_url.trim() && candidate.apply_url.trim() !== "#") &&
      src?.enabled === true &&
      src?.validation_state === "allowed" &&
      SUPPORTED_SOURCE_TYPES.has((candidate.source_type || "").toLowerCase()) &&
      SUPPORTED_SOURCE_TYPES.has((src?.source_type || "").toLowerCase());

    if (!eligible) {
      skipped += 1;
      await supabaseAdmin
        .from("sourcing_sourced_job_candidates")
        .update({ publish_status: "skipped_not_eligible", publish_notes: "Not eligible for auto-publish." })
        .eq("id", candidate.id);
      results.push({ candidateId: candidate.id, status: "skipped" });
      continue;
    }

    // Duplicate publish prevention: do not insert if apply_url already exists as a job.
    const applyUrl = (candidate.apply_url || "").trim();
    const { data: existingJob } = await supabaseAdmin
      .from("jobs")
      .select("id")
      .eq("apply_url", applyUrl)
      .maybeSingle();

    if (existingJob?.id) {
      skipped += 1;
      await supabaseAdmin
        .from("sourcing_sourced_job_candidates")
        .update({
          published_job_id: existingJob.id,
          published_at: new Date().toISOString(),
          publish_status: "skipped_duplicate",
          publish_notes: "Existing job with same apply_url.",
        })
        .eq("id", candidate.id);
      results.push({ candidateId: candidate.id, status: "skipped_duplicate", jobId: existingJob.id });
      continue;
    }

    // Company: prefer linked company_id from source. If missing, create a minimal company record only if we have a company_name.
    let companyId: string | null = src?.company_id || null;
    if (!companyId) {
      const companyName = (candidate.company_name || src?.display_name || "").trim();
      if (!companyName) {
        skipped += 1;
        await supabaseAdmin
          .from("sourcing_sourced_job_candidates")
          .update({ publish_status: "skipped_not_eligible", publish_notes: "Missing company context." })
          .eq("id", candidate.id);
        results.push({ candidateId: candidate.id, status: "skipped", reason: "missing_company" });
        continue;
      }

      const { data: companyRow, error: cErr } = await supabaseAdmin
        .from("companies")
        .upsert(
          {
            name: companyName,
            website: null,
            logo_url: null,
            created_by: auth.profile.id,
          },
          { onConflict: "name" },
        )
        .select("id")
        .single();
      if (cErr || !companyRow?.id) {
        failed += 1;
        await supabaseAdmin
          .from("sourcing_sourced_job_candidates")
          .update({ publish_status: "failed", publish_notes: "Company upsert failed." })
          .eq("id", candidate.id);
        results.push({ candidateId: candidate.id, status: "failed", error: "company_upsert_failed" });
        continue;
      }
      companyId = companyRow.id as string;
    }

    // Map fields conservatively.
    const now = Date.now();
    const timestamp = candidate.posted_at ? Date.parse(candidate.posted_at) : now;
    const salaryText =
      (candidate.salary_text_raw || "").trim() ||
      (candidate.salary_amount_min || candidate.salary_amount_max
        ? `${candidate.salary_amount_min ?? ""}-${candidate.salary_amount_max ?? ""} ${candidate.salary_currency ?? ""} ${candidate.salary_period ?? ""}`.trim()
        : "");

    const jobInsert = {
      company_id: companyId,
      title: (candidate.title || "").trim() || "Untitled role",
      description: (candidate.description_clean || "").trim() || "",
      location: candidate.location_text || null,
      remote_policy: candidate.remote_policy || null,
      type: null,
      salary: salaryText || null,
      salary_min: candidate.salary_amount_min || null,
      salary_max: candidate.salary_amount_max || null,
      salary_currency: candidate.salary_currency || null,
      posted_at_text: candidate.posted_at ? new Date(candidate.posted_at).toISOString().slice(0, 10) : "Just now",
      timestamp: Number.isFinite(timestamp) ? Math.floor(timestamp) : now,
      category: null,
      apply_url: applyUrl,
      company_description: null,
      company_website: null,
      logo_url: src?.companies?.logo_url || null,
      tags: null,
      tools: null,
      benefits: null,
      keywords: null,
      match_score: null,
      is_featured: false,
      status: "published",
      created_by: auth.profile.id,
      published_at: new Date().toISOString(),
    };

    try {
      const { data: newJob, error: jErr } = await supabaseAdmin.from("jobs").insert(jobInsert).select("id").single();
      if (jErr || !newJob?.id) throw new Error("job_insert_failed");

      await supabaseAdmin
        .from("sourcing_sourced_job_candidates")
        .update({
          published_job_id: newJob.id,
          published_at: new Date().toISOString(),
          publish_status: "auto_published",
          publish_notes: `Auto-published via policy v1. score=${scoreTotal}.`,
        })
        .eq("id", candidate.id);

      await supabaseAdmin.from("audit_logs").insert({
        actor_id: auth.profile.id,
        job_id: newJob.id,
        action: "sourcing_auto_publish",
        metadata: {
          candidate_id: candidate.id,
          source_id: candidate.source_id,
          source_type: candidate.source_type,
          score_total: scoreTotal,
          decision,
          dedupe_confidence: dupConfidence,
        },
      });

      published += 1;
      results.push({ candidateId: candidate.id, status: "published", jobId: newJob.id });
    } catch (e) {
      failed += 1;
      await supabaseAdmin
        .from("sourcing_sourced_job_candidates")
        .update({ publish_status: "failed", publish_notes: e instanceof Error ? e.message : "Publish failed." })
        .eq("id", candidate.id);
      results.push({ candidateId: candidate.id, status: "failed" });
    }
  }

  return NextResponse.json({
    processed: rows.length,
    published,
    skipped,
    failed,
    minScore: AUTO_PUBLISH_MIN_SCORE,
    supportedSources: Array.from(SUPPORTED_SOURCE_TYPES),
    results: results.slice(0, 50),
  });
}

