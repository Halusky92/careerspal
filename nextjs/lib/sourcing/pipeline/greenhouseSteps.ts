import type { SupabaseClient } from "@supabase/supabase-js";

import {
  fetchGreenhouseJobDetail,
  fetchGreenhouseJobsList,
  inferGreenhouseBoardTokenFromUrl,
  mapLimit,
  sha256Json,
} from "../connectors/greenhouse";
import { normalizeGreenhouseRawPayload } from "../normalization/greenhouse";
import { scoreCandidate } from "../evaluation/scoring";
import { dedupeAgainst, type CandidateForDedupe } from "../evaluation/dedupe";
import { prepareDecision } from "../evaluation/decision";
import { getSourcingAutoPublishMinScore, getSourcingAutoPublishSupportedSourceTypes } from "../config";

type AdminSb = SupabaseClient<any, "public", any>;

type SourceRow = {
  id: string;
  base_url: string;
  normalized_url: string;
  ats_identifier: string | null;
};

export async function ingestGreenhouseRawJobs(sb: AdminSb, args: { sourceId?: string | null }) {
  const sourceId = (args.sourceId || "").trim() || null;

  let query = sb
    .from("sourcing_sources")
    .select("id,base_url,normalized_url,ats_identifier")
    .eq("source_type", "greenhouse")
    .eq("validation_state", "allowed")
    .eq("enabled", true);

  if (sourceId) query = query.eq("id", sourceId);

  const { data: sources, error: srcErr } = await query.order("created_at", { ascending: false });
  if (srcErr) throw new Error("Unable to load sources.");

  const results: any[] = [];
  for (const s of (sources as SourceRow[] | null) || []) {
    const startedAt = new Date().toISOString();
    const { data: runRow } = await sb
      .from("sourcing_source_runs")
      .insert({
        source_id: s.id,
        status: "failed",
        started_at: startedAt,
        fetched_count: 0,
        new_raw_count: 0,
        new_candidates_count: 0,
        inserted_count: 0,
        skipped_count: 0,
      })
      .select("id")
      .single();

    const runId = (runRow?.id as string | undefined) || null;

    const boardToken =
      (s.ats_identifier || "").trim().toLowerCase() || inferGreenhouseBoardTokenFromUrl(s.normalized_url) || null;

    if (!boardToken) {
      if (runId) {
        await sb
          .from("sourcing_source_runs")
          .update({
            status: "failed",
            finished_at: new Date().toISOString(),
            error_summary: "Missing Greenhouse board token (ats_identifier).",
          })
          .eq("id", runId);
      }
      results.push({ sourceId: s.id, status: "failed", error: "Missing board token." });
      continue;
    }

    try {
      const list = await fetchGreenhouseJobsList(boardToken);
      const fetchedCount = list.length;

      let detailFailures = 0;
      const detailRows = await mapLimit(list, 3, async (job) => {
        try {
          const detail = await fetchGreenhouseJobDetail(boardToken, job.id);
          const payloadHash = sha256Json(detail);
          const jobUrl = (job.absolute_url || null) as string | null;
          const title = (job.title || null) as string | null;
          return {
            ok: true as const,
            row: {
              source_id: s.id,
              source_run_id: runId,
              source_type: "greenhouse",
              source_url: s.normalized_url,
              external_job_id: String(job.id),
              job_url: jobUrl,
              title,
              raw_payload: detail,
              payload_hash: payloadHash,
              fetched_at: new Date().toISOString(),
            },
          };
        } catch (e) {
          detailFailures += 1;
          return { ok: false as const, error: e instanceof Error ? e.message : "Detail fetch failed" };
        }
      });

      const rows = detailRows.filter((x) => x.ok).map((x) => (x as any).row);
      const insertAttempted = rows.length;

      let insertedCount = 0;
      if (rows.length > 0) {
        const { data: inserted, error: insErr } = await sb
          .from("sourcing_sourced_jobs_raw")
          .upsert(rows, { onConflict: "source_id,external_job_id", ignoreDuplicates: true })
          .select("id");
        if (insErr) {
          throw new Error("Raw upsert failed.");
        }
        insertedCount = (inserted || []).length;
      }

      const skippedCount = Math.max(0, fetchedCount - insertedCount);
      const finishedAt = new Date().toISOString();
      const status = detailFailures > 0 ? "partial" : "success";

      if (runId) {
        await sb
          .from("sourcing_source_runs")
          .update({
            status,
            finished_at: finishedAt,
            fetched_count: fetchedCount,
            new_raw_count: insertedCount,
            inserted_count: insertedCount,
            skipped_count: skippedCount,
            error_summary: detailFailures > 0 ? `Detail fetch failures: ${detailFailures}` : null,
            http_summary: {
              boardToken,
              fetchedCount,
              insertAttempted,
              insertedCount,
              skippedCount,
              detailFailures,
            },
          })
          .eq("id", runId);
      }

      results.push({
        sourceId: s.id,
        runId,
        status,
        fetchedCount,
        insertedCount,
        skippedCount,
        detailFailures,
      });
    } catch (e) {
      const finishedAt = new Date().toISOString();
      const msg = e instanceof Error ? e.message : "Greenhouse run failed";
      if (runId) {
        await sb
          .from("sourcing_source_runs")
          .update({
            status: "failed",
            finished_at: finishedAt,
            error_summary: msg,
          })
          .eq("id", runId);
      }
      results.push({ sourceId: s.id, runId, status: "failed", error: msg });
    }
  }

  return { ran: results.length, results };
}

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

export async function normalizeGreenhouseRawJobsToCandidates(
  sb: AdminSb,
  args: { sourceId?: string | null; runId?: string | null; limit?: number },
) {
  const sourceId = (args.sourceId || "").trim();
  const runId = (args.runId || "").trim();
  const limit = Math.min(500, Math.max(1, Number(args.limit) || 200));

  let q = sb
    .from("sourcing_sourced_jobs_raw")
    .select("id,source_id,source_run_id,source_type,source_url,external_job_id,job_url,title,raw_payload,payload_hash")
    .eq("source_type", "greenhouse")
    .order("fetched_at", { ascending: false })
    .limit(limit);

  if (sourceId) q = q.eq("source_id", sourceId);
  if (runId) q = q.eq("source_run_id", runId);

  const { data, error } = await q;
  if (error) throw new Error("Unable to load raw jobs.");

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const errors: Array<{ rawId: string; error: string }> = [];

  for (const row of (data as RawRow[] | null) || []) {
    try {
      // Idempotency: if candidate exists with same payload_hash, skip.
      const { data: existing } = await sb
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

      const { data: upserted, error: upErr } = await sb
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

  if (runId) {
    await sb
      .from("sourcing_source_runs")
      .update({
        new_candidates_count: inserted + updated,
        error_summary: errors.length > 0 ? `Normalization errors: ${errors.length}` : null,
      })
      .eq("id", runId);
  }

  return { processed: (data || []).length, inserted, updated, skipped, errors: errors.slice(0, 20) };
}

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

type SourceTrustRow = { id: string; validation_state: string; enabled: boolean; source_type: string };

export async function evaluateCandidates(
  sb: AdminSb,
  args: { sourceId?: string | null; runId?: string | null; limit?: number },
) {
  const sourceId = (args.sourceId || "").trim();
  const runId = (args.runId || "").trim();
  const limit = Math.min(500, Math.max(1, Number(args.limit) || 200));

  let q = sb
    .from("sourcing_sourced_job_candidates")
    .select(
      "id,source_id,source_run_id,source_type,source_url,external_job_id,job_url,apply_url,title,company_name,location_text,remote_policy,description_clean,salary_present",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (sourceId) q = q.eq("source_id", sourceId);
  if (runId) q = q.eq("source_run_id", runId);

  const { data: candidates, error: candErr } = await q;
  if (candErr) throw new Error("Unable to load candidates.");

  const candidateRows = (candidates as CandidateRow[] | null) || [];
  if (candidateRows.length === 0) return { processed: 0, evaluated: 0, errors: [] as any[] };

  const sourceIds = Array.from(new Set(candidateRows.map((c) => c.source_id)));
  const { data: sources } = await sb
    .from("sourcing_sources")
    .select("id,validation_state,enabled,source_type")
    .in("id", sourceIds);

  const sourceMap = new Map<string, SourceTrustRow>();
  ((sources as SourceTrustRow[] | null) || []).forEach((s) => sourceMap.set(s.id, s));

  const batchForDedupe: CandidateForDedupe[] = candidateRows.map((c) => ({
    id: c.id,
    title: c.title,
    company_name: c.company_name,
    apply_url: c.apply_url,
    job_url: c.job_url,
  }));

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
    const { data: jobs } = await sb.from("jobs").select("id,apply_url").in("apply_url", applyUrls);
    ((jobs as any[] | null) || []).forEach((j) => {
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

      await sb
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

      await sb
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

      await sb
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

  return { processed: candidateRows.length, evaluated, errors: errors.slice(0, 20) };
}

type AutoPublishCandidateRow = {
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

type SourceRowForPublish = {
  id: string;
  company_id: string | null;
  enabled: boolean;
  validation_state: string;
  source_type: string;
  display_name: string | null;
  companies?: { id: string; name: string; website: string | null; logo_url: string | null; slug: string | null } | null;
};

export async function autoPublishEligibleCandidates(
  sb: AdminSb,
  args: { actorId: string | null; sourceId?: string | null; runId?: string | null; limit?: number },
) {
  const AUTO_PUBLISH_MIN_SCORE = getSourcingAutoPublishMinScore();
  const SUPPORTED_SOURCE_TYPES = getSourcingAutoPublishSupportedSourceTypes();

  const actorId = args.actorId;
  const sourceId = (args.sourceId || "").trim();
  const runId = (args.runId || "").trim();
  const limit = Math.min(300, Math.max(1, Number(args.limit) || 100));

  let q = sb
    .from("sourcing_sourced_job_candidates")
    .select(
      "id,source_id,source_run_id,source_type,source_url,external_job_id,job_url,apply_url,title,company_name,location_text,remote_policy,posted_at,description_clean,salary_text_raw,salary_amount_min,salary_amount_max,salary_currency,salary_period,salary_present,published_job_id,publish_status," +
        "sourcing_candidate_scores(score_total)," +
        // Disambiguate relationship: sourcing_candidate_dedupes has 2 FKs to candidates (candidate_id + duplicate_of_candidate_id)
        "sourcing_candidate_dedupes!sourcing_candidate_dedupes_candidate_id_fkey(confidence,duplicate_of_job_id)," +
        "sourcing_candidate_decisions(decision,blocking_reason_codes,warning_reason_codes)",
    )
    .is("published_job_id", null)
    // Also reconsider candidates previously skipped for eligibility; conditions can change after enrichment (e.g. salary).
    .in("publish_status", ["not_published", "skipped_not_eligible"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (sourceId) q = q.eq("source_id", sourceId);
  if (runId) q = q.eq("source_run_id", runId);

  const { data, error } = await q;
  if (error) throw new Error("Unable to load candidates.");

  const rows = (data as any[] | null) || [];
  if (rows.length === 0) {
    return { processed: 0, published: 0, skipped: 0, failed: 0, minScore: AUTO_PUBLISH_MIN_SCORE };
  }

  const sourceIds = Array.from(new Set(rows.map((r) => r.source_id)));
  const { data: sources } = await sb
    .from("sourcing_sources")
    .select("id,company_id,enabled,validation_state,source_type,display_name,companies(id,name,website,logo_url,slug)")
    .in("id", sourceIds);

  const sourceMap = new Map<string, SourceRowForPublish>();
  ((sources as any[] | null) || []).forEach((s) => sourceMap.set(s.id, s as SourceRowForPublish));

  let published = 0;
  let skipped = 0;
  let failed = 0;
  const results: any[] = [];

  for (const r of rows) {
    const candidate = r as AutoPublishCandidateRow & {
      sourcing_candidate_scores?: { score_total?: number } | null;
      sourcing_candidate_dedupes?: { confidence?: string; duplicate_of_job_id?: string | null } | null;
      sourcing_candidate_decisions?: { decision?: string; blocking_reason_codes?: any[]; warning_reason_codes?: any[] } | null;
    };

    const src = sourceMap.get(candidate.source_id);
    const scoreTotal = Number(candidate.sourcing_candidate_scores?.score_total ?? 0);
    const decision = candidate.sourcing_candidate_decisions?.decision || null;
    const blocking = (candidate.sourcing_candidate_decisions?.blocking_reason_codes as string[] | undefined) || [];
    const dupConfidence = (candidate.sourcing_candidate_dedupes?.confidence || "none").toString();

    const ineligibleReasons: string[] = [];
    if (decision !== "auto_publish_candidate") ineligibleReasons.push(`decision=${decision || "null"}`);
    if (!(scoreTotal >= AUTO_PUBLISH_MIN_SCORE)) ineligibleReasons.push(`score_below_min(${scoreTotal}<${AUTO_PUBLISH_MIN_SCORE})`);
    if (candidate.salary_present !== true) ineligibleReasons.push("salary_missing");
    if (dupConfidence === "high") ineligibleReasons.push("duplicate_high");
    if (blocking.length > 0) ineligibleReasons.push(`blocking=${blocking.join(",")}`);
    if (!Boolean(candidate.apply_url && candidate.apply_url.trim() && candidate.apply_url.trim() !== "#"))
      ineligibleReasons.push("apply_missing");
    if (src?.enabled !== true) ineligibleReasons.push("source_disabled");
    if (src?.validation_state !== "allowed") ineligibleReasons.push(`source_not_allowed(${src?.validation_state || "null"})`);
    if (!SUPPORTED_SOURCE_TYPES.has((candidate.source_type || "").toLowerCase()))
      ineligibleReasons.push(`candidate_source_unsupported(${(candidate.source_type || "").toLowerCase() || "null"})`);
    if (!SUPPORTED_SOURCE_TYPES.has((src?.source_type || "").toLowerCase()))
      ineligibleReasons.push(`source_type_unsupported(${(src?.source_type || "").toLowerCase() || "null"})`);
    // Also require some company context; otherwise we can't publish into public.jobs reliably.
    if (!src?.company_id) {
      const companyName = (candidate.company_name || src?.display_name || "").trim();
      if (!companyName) ineligibleReasons.push("missing_company");
    }

    const eligible = ineligibleReasons.length === 0;

    if (!eligible) {
      skipped += 1;
      await sb
        .from("sourcing_sourced_job_candidates")
        .update({
          publish_status: "skipped_not_eligible",
          publish_notes: `Not eligible for auto-publish. ${ineligibleReasons.join("; ")}`.trim(),
        })
        .eq("id", candidate.id);
      results.push({ candidateId: candidate.id, status: "skipped", reason: ineligibleReasons });
      continue;
    }

    const applyUrl = (candidate.apply_url || "").trim();
    const { data: existingJob } = await sb.from("jobs").select("id").eq("apply_url", applyUrl).maybeSingle();
    if (existingJob?.id) {
      skipped += 1;
      await sb
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

    let companyId: string | null = src?.company_id || null;
    if (!companyId) {
      const companyName = (candidate.company_name || src?.display_name || "").trim();
      if (!companyName) {
        skipped += 1;
        await sb
          .from("sourcing_sourced_job_candidates")
          .update({ publish_status: "skipped_not_eligible", publish_notes: "Missing company context." })
          .eq("id", candidate.id);
        results.push({ candidateId: candidate.id, status: "skipped", reason: "missing_company" });
        continue;
      }

      const { data: companyRow, error: cErr } = await sb
        .from("companies")
        .upsert(
          {
            name: companyName,
            website: null,
            logo_url: null,
            created_by: actorId,
          },
          { onConflict: "name" },
        )
        .select("id")
        .single();
      if (cErr || !companyRow?.id) {
        failed += 1;
        await sb
          .from("sourcing_sourced_job_candidates")
          .update({ publish_status: "failed", publish_notes: "Company upsert failed." })
          .eq("id", candidate.id);
        results.push({ candidateId: candidate.id, status: "failed", error: "company_upsert_failed" });
        continue;
      }
      companyId = companyRow.id as string;
    }

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
      created_by: actorId,
      published_at: new Date().toISOString(),
    };

    try {
      const { data: newJob, error: jErr } = await sb.from("jobs").insert(jobInsert).select("id").single();
      if (jErr || !newJob?.id) throw new Error("job_insert_failed");

      await sb
        .from("sourcing_sourced_job_candidates")
        .update({
          published_job_id: newJob.id,
          published_at: new Date().toISOString(),
          publish_status: "auto_published",
          publish_notes: `Auto-published via policy v1. score=${scoreTotal}.`,
        })
        .eq("id", candidate.id);

      await sb.from("audit_logs").insert({
        actor_id: actorId,
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
      await sb
        .from("sourcing_sourced_job_candidates")
        .update({ publish_status: "failed", publish_notes: e instanceof Error ? e.message : "Publish failed." })
        .eq("id", candidate.id);
      results.push({ candidateId: candidate.id, status: "failed" });
    }
  }

  return {
    processed: rows.length,
    published,
    skipped,
    failed,
    minScore: AUTO_PUBLISH_MIN_SCORE,
    supportedSources: Array.from(SUPPORTED_SOURCE_TYPES),
    results: results.slice(0, 50),
  };
}

