import type { SupabaseClient } from "@supabase/supabase-js";

import {
  fetchGreenhouseJobDetail,
  fetchGreenhouseJobsList,
  inferGreenhouseBoardTokenFromUrl,
  mapLimit,
  sha256Json,
} from "../connectors/greenhouse";
import { normalizeGreenhouseRawPayload } from "../normalization/greenhouse";
import { normalizeAshbyRawPayload } from "../normalization/ashby";
import { normalizeLeverRawPayload } from "../normalization/lever";
import { scoreCandidate } from "../evaluation/scoring";
import { dedupeAgainst, type CandidateForDedupe } from "../evaluation/dedupe";
import { prepareDecision } from "../evaluation/decision";
import { getSourcingAutoPublishMinScore, getSourcingAutoPublishSupportedSourceTypes } from "../config";
import { stripHtmlToText } from "../normalization/text";
import { formatSourcedDescription } from "../normalization/description";
import { detectEmploymentType } from "../normalization/employmentType";
import { detectNotionSignal } from "../signals/notion";
import { createCompanySlug } from "../../jobs";
import { enrichCompanyFromWebsite } from "../../companyEnrichment";
import { publicLogoUrlForWebsite } from "../../companyLogoUrl";
import { isOnNicheJob } from "../../nicheScope";
import { probeApplyUrl } from "../../jobs/applyLinkHealth";
import { formatSalaryForStorage } from "../../formatSalary";
import { roundSalaryAmount, type SalaryPeriod } from "../normalization/salary";
import { isBoilerplateDescription } from "../../companyBoard";
import { inferWorkMode } from "../../workMode";

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
      if (/\(404\)/.test(msg) || msg.includes("Missing board token")) {
        await sb.from("sourcing_sources").update({ enabled: false }).eq("id", s.id);
      }
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
    .in("source_type", ["greenhouse", "ashby", "lever"])
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

      const normalized =
        row.source_type === "ashby"
          ? normalizeAshbyRawPayload({
              sourceUrl: row.source_url,
              externalJobId: row.external_job_id,
              companyName: null,
              rawPayload: row.raw_payload,
            })
          : row.source_type === "lever"
            ? normalizeLeverRawPayload({
                sourceUrl: row.source_url,
                externalJobId: row.external_job_id,
                companyName: null,
                rawPayload: row.raw_payload,
              })
            : normalizeGreenhouseRawPayload({
                sourceUrl: row.source_url,
                externalJobId: row.external_job_id,
                companyName: null,
                rawPayload: row.raw_payload,
              });

      if (
        !isOnNicheJob({
          title: normalized.title,
          category: null,
          description: null,
        })
      ) {
        skipped += 1;
        if (existing?.id) {
          await sb
            .from("sourcing_sourced_job_candidates")
            .update({
              publish_status: "skipped_not_eligible",
              publish_notes:
                "Skipped at normalize: outside CareersPal niche (Ops / Systems / Automation / RevOps / Product Ops / Chief of Staff).",
            })
            .eq("id", existing.id);
        }
        continue;
      }

      const upsertRow = {
        raw_job_id: row.id,
        source_id: row.source_id,
        source_run_id: row.source_run_id,
        source_type: normalized.source_type,
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
  provenance: any;
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
      "id,source_id,source_run_id,source_type,source_url,external_job_id,job_url,apply_url,title,company_name,location_text,remote_policy,description_clean,salary_present,provenance",
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
      const teamText =
        (c as any)?.provenance && typeof (c as any).provenance === "object"
          ? ((c as any).provenance.team_text || "")?.toString?.().trim?.() || null
          : null;
      const scoring = scoreCandidate({
        title: c.title,
        company_name: c.company_name,
        apply_url: c.apply_url,
        job_url: c.job_url,
        location_text: c.location_text,
        remote_policy: c.remote_policy,
        description_clean: c.description_clean,
        team_text: teamText,
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
  ats_identifier?: string | null;
  normalized_url?: string | null;
  base_url?: string | null;
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
    .select(
      "id,company_id,enabled,validation_state,source_type,display_name,ats_identifier,normalized_url,base_url,companies(id,name,website,logo_url,slug)",
    )
    .in("id", sourceIds);

  const sourceMap = new Map<string, SourceRowForPublish>();
  ((sources as any[] | null) || []).forEach((s) => sourceMap.set(s.id, s as SourceRowForPublish));

  let published = 0;
  let skipped = 0;
  let failed = 0;
  const results: any[] = [];

  const deriveCompanyName = (candidate: AutoPublishCandidateRow, src?: SourceRowForPublish) => {
    const fromCandidate = (candidate.company_name || "").trim();
    if (fromCandidate) return fromCandidate;

    const fromDisplay = (src?.display_name || "").trim();
    if (fromDisplay) return fromDisplay;

    // Greenhouse canonical board token is often a good fallback, e.g. "samsara" -> "Samsara".
    const token = (src?.ats_identifier || "").trim();
    if (token) return token.charAt(0).toUpperCase() + token.slice(1);

    const url = (src?.normalized_url || src?.base_url || candidate.source_url || "").toString();
    if (url) {
      const m = url.match(/boards\.greenhouse\.io\/([^/?#]+)/i);
      if (m?.[1]) {
        const t = m[1].trim();
        if (t) return t.charAt(0).toUpperCase() + t.slice(1);
      }
    }

    return "";
  };

  const isAtsHost = (hostname: string) => {
    const h = hostname.replace(/^www\./, "").toLowerCase();
    return (
      h.endsWith("greenhouse.io") ||
      h.endsWith("lever.co") ||
      h.endsWith("ashbyhq.com") ||
      h.endsWith("myworkdayjobs.com") ||
      h.endsWith("workable.com")
    );
  };

  const deriveCompanyWebsite = (candidate: AutoPublishCandidateRow, src?: SourceRowForPublish) => {
    const tryUrl = (value?: string | null) => {
      const raw = (value || "").trim();
      if (!raw || raw === "#" || raw.startsWith("mailto:") || raw.startsWith("/")) return null;
      try {
        const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
        if (isAtsHost(u.hostname)) return null;
        return `${u.protocol}//${u.hostname}`;
      } catch {
        return null;
      }
    };
    const fromDescription = () => {
      const text = (candidate.description_clean || "").toString();
      const matches = text.match(/https?:\/\/[^\s)"']+/gi) || [];
      for (const m of matches) {
        const hit = tryUrl(m.replace(/[.,;]+$/, ""));
        if (hit) return hit;
      }
      return null;
    };
    const knownByToken: Record<string, string> = {
      checkr: "https://www.checkr.com",
      pendo: "https://www.pendo.io",
    };
    const token = (src?.ats_identifier || "").toString().trim().toLowerCase();
    return (
      tryUrl(src?.companies?.website || null) ||
      fromDescription() ||
      tryUrl(candidate.job_url) ||
      tryUrl(candidate.apply_url) ||
      tryUrl(knownByToken[token] || null) ||
      tryUrl(src?.normalized_url || null) ||
      tryUrl(src?.base_url || null) ||
      null
    );
  };

  const deriveFaviconUrl = (website: string | null) => publicLogoUrlForWebsite(website);

  const inferCategory = (candidate: AutoPublishCandidateRow) => {
    const blob = [candidate.title, candidate.description_clean, candidate.location_text, candidate.remote_policy]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!blob) return "Other";
    if (blob.includes("chief of staff") || blob.includes("office of the ceo") || blob.includes("strategic initiatives"))
      return "Executive & Staff";
    if (blob.includes("product ops") || blob.includes("product operations")) return "Product Management";
    if (
      blob.includes("revops") ||
      blob.includes("revenue operations") ||
      blob.includes("marketing ops") ||
      blob.includes("sales ops") ||
      blob.includes("gtm operations")
    )
      return "Marketing & Growth Ops"; // TEMP mapping for RevOps hub
    if (blob.includes("automation") || blob.includes("zapier") || blob.includes("make.com") || blob.includes("n8n"))
      return "Automation";
    if (
      blob.includes("systems") ||
      blob.includes("business systems") ||
      blob.includes("salesforce") ||
      blob.includes("hubspot") ||
      blob.includes("netsuite") ||
      blob.includes("workday") ||
      blob.includes("integrations")
    )
      return "Systems Design";
    // Only classify as Operations when we see explicit ops language (avoid defaulting unknown roles).
    const ops =
      blob.includes("operations") ||
      blob.includes("business operations") ||
      blob.includes("bizops") ||
      blob.includes(" ops ");
    const looksLikeDevOps = blob.includes("devops") || blob.includes("site reliability") || blob.includes("sre");
    if (ops && !looksLikeDevOps) return "Operations";
    return "Other";
  };

  const extractTools = (text: string) => {
    const t = (text || "").toLowerCase();
    if (!t) return [] as string[];
    const tools = [
      "Notion",
      "Airtable",
      "Zapier",
      "Make",
      "Make.com",
      "n8n",
      "Salesforce",
      "HubSpot",
      "NetSuite",
      "Workday",
      "Slack",
      "Jira",
      "Asana",
      "Linear",
      "SQL",
      "Looker",
      "Tableau",
      "Google Sheets",
      "Sheets",
      "Excel",
      "Snowflake",
      "Segment",
    ];
    const hits = tools.filter((tool) => {
      const needle = tool.toLowerCase();
      if (needle === "make.com") return t.includes("make.com") || t.includes(" make ");
      if (needle === "sheets") return t.includes("google sheets") || t.includes(" spreadsheets ") || t.includes("sheet");
      return t.includes(needle);
    });
    // Normalize: keep unique + prefer canonical casing.
    const normalized = hits.map((x) => (x === "Sheets" ? "Google Sheets" : x === "Make.com" ? "Make" : x));
    return Array.from(new Set(normalized)).slice(0, 12);
  };

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
    const derivedCompanyName = deriveCompanyName(candidate, src);
    const derivedCompanyWebsite = deriveCompanyWebsite(candidate, src);
    const derivedCompanySlug = derivedCompanyName ? createCompanySlug({ name: derivedCompanyName }) : null;
    const derivedLogoUrl = deriveFaviconUrl(derivedCompanyWebsite);

    const ineligibleReasons: string[] = [];
    if (decision !== "auto_publish_candidate") ineligibleReasons.push(`decision=${decision || "null"}`);
    if (!(scoreTotal >= AUTO_PUBLISH_MIN_SCORE)) ineligibleReasons.push(`score_below_min(${scoreTotal}<${AUTO_PUBLISH_MIN_SCORE})`);
    if (candidate.salary_present !== true) ineligibleReasons.push("salary_missing");
    if (candidate.salary_amount_min == null && candidate.salary_amount_max == null)
      ineligibleReasons.push("salary_range_missing");
    if (dupConfidence === "high") ineligibleReasons.push("duplicate_high");
    if (blocking.length > 0) ineligibleReasons.push(`blocking=${blocking.join(",")}`);
    if (!Boolean(candidate.apply_url && candidate.apply_url.trim() && candidate.apply_url.trim() !== "#"))
      ineligibleReasons.push("apply_missing");
    if (((candidate.description_clean || "").trim().length) < 280)
      ineligibleReasons.push("description_thin");
    if (src?.enabled !== true) ineligibleReasons.push("source_disabled");
    if (src?.validation_state !== "allowed") ineligibleReasons.push(`source_not_allowed(${src?.validation_state || "null"})`);
    if (!SUPPORTED_SOURCE_TYPES.has((candidate.source_type || "").toLowerCase()))
      ineligibleReasons.push(`candidate_source_unsupported(${(candidate.source_type || "").toLowerCase() || "null"})`);
    if (!SUPPORTED_SOURCE_TYPES.has((src?.source_type || "").toLowerCase()))
      ineligibleReasons.push(`source_type_unsupported(${(src?.source_type || "").toLowerCase() || "null"})`);
    // Also require some company context; otherwise we can't publish into public.jobs reliably.
    if (!src?.company_id) {
      if (!derivedCompanyName) ineligibleReasons.push("missing_company");
    }
    if (
      !isOnNicheJob({
        title: candidate.title,
        category: null,
        description: candidate.description_clean,
      })
    ) {
      ineligibleReasons.push("off_niche_title");
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
    const applyProbe = await probeApplyUrl(applyUrl);
    if (applyProbe.dead) {
      skipped += 1;
      await sb
        .from("sourcing_sourced_job_candidates")
        .update({
          publish_status: "skipped_not_eligible",
          publish_notes: `Apply link is not live (${applyProbe.reason}).`,
        })
        .eq("id", candidate.id);
      results.push({ candidateId: candidate.id, status: "skipped", reason: `apply_dead:${applyProbe.reason}` });
      continue;
    }
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
      const companyName = derivedCompanyName;
      if (!companyName) {
        skipped += 1;
        await sb
          .from("sourcing_sourced_job_candidates")
          .update({ publish_status: "skipped_not_eligible", publish_notes: "Missing company context." })
          .eq("id", candidate.id);
        results.push({ candidateId: candidate.id, status: "skipped", reason: "missing_company" });
        continue;
      }

      // Create / patch company record (avoid overwriting non-null fields).
      const { data: existingCompany } = await sb
        .from("companies")
        .select("id,slug,website,logo_url")
        .eq("name", companyName)
        .maybeSingle();

      if (!existingCompany?.id) {
        // Idempotent create: upsert on unique company name (safe for races).
        const { data: createdCompany, error: cErr } = await sb
          .from("companies")
          .upsert(
            {
              name: companyName,
              slug: derivedCompanySlug,
              website: derivedCompanyWebsite,
              logo_url: derivedLogoUrl,
              created_by: actorId,
            },
            { onConflict: "name" },
          )
          .select("id")
          .single();

        if (cErr || !createdCompany?.id) {
          failed += 1;
          await sb
            .from("sourcing_sourced_job_candidates")
            .update({ publish_status: "failed", publish_notes: "Company insert failed." })
            .eq("id", candidate.id);
          results.push({ candidateId: candidate.id, status: "failed", error: "company_insert_failed" });
          continue;
        }
        companyId = createdCompany.id as string;
      } else {
        companyId = existingCompany.id as string;
        const patch: Record<string, unknown> = {};
        if (!existingCompany.slug && derivedCompanySlug) patch.slug = derivedCompanySlug;
        if (!existingCompany.website && derivedCompanyWebsite) patch.website = derivedCompanyWebsite;
        if (!existingCompany.logo_url && derivedLogoUrl) patch.logo_url = derivedLogoUrl;
        if (Object.keys(patch).length > 0) {
          await sb.from("companies").update(patch).eq("id", companyId);
        }
      }

      if (!companyId) {
        failed += 1;
        await sb
          .from("sourcing_sourced_job_candidates")
          .update({ publish_status: "failed", publish_notes: "Company upsert failed." })
          .eq("id", candidate.id);
        results.push({ candidateId: candidate.id, status: "failed", error: "company_upsert_failed" });
        continue;
      }
    }

    if (companyId && (derivedCompanyWebsite || derivedLogoUrl)) {
      try {
        const { data: after } = await sb.from("companies").select("id,description,logo_url,website").eq("id", companyId).single();
        const needsDesc = !((after as any)?.description || "").toString().trim();
        const needsLogo = !((after as any)?.logo_url || "").toString().trim();
        const needsWebsite = !((after as any)?.website || "").toString().trim();
        const patch: Record<string, unknown> = {};
        if (needsWebsite && derivedCompanyWebsite) patch.website = derivedCompanyWebsite;
        if (needsLogo && derivedLogoUrl) patch.logo_url = derivedLogoUrl;
        if ((needsDesc || needsLogo || needsWebsite) && derivedCompanyWebsite) {
          const enr = await enrichCompanyFromWebsite({ websiteUrl: derivedCompanyWebsite });
          if (needsWebsite && enr.website) patch.website = enr.website;
          if (needsDesc && enr.description) patch.description = enr.description;
          if (needsLogo && enr.logo_url) patch.logo_url = enr.logo_url;
        }
        if (needsLogo && !patch.logo_url && (patch.website || derivedCompanyWebsite)) {
          patch.logo_url = publicLogoUrlForWebsite(String(patch.website || derivedCompanyWebsite));
        }
        if (Object.keys(patch).length > 0) {
          await sb.from("companies").update(patch).eq("id", companyId);
        }
      } catch {
        // don't block publish
      }
    }

  // Salary sanity: block obviously wrong parsed salaries (e.g. "$1-$2") from being published.
  // (Salary parsing happens earlier; this is an extra last-line defense.)
  const period = (candidate.salary_period || "").toString().toLowerCase();
  const periodKey = (period || "year") as SalaryPeriod;
  const minAmt = typeof candidate.salary_amount_min === "number" ? roundSalaryAmount(candidate.salary_amount_min, periodKey) : null;
  const maxAmt = typeof candidate.salary_amount_max === "number" ? roundSalaryAmount(candidate.salary_amount_max, periodKey) : null;
  const floor =
    period === "hour" ? 10 : period === "day" ? 80 : period === "month" ? 1500 : period === "year" ? 20000 : null;
  const ceil =
    period === "hour" ? 500 : period === "day" ? 4000 : period === "month" ? 80000 : period === "year" ? 800000 : null;
  if (floor != null) {
    const loBad = minAmt != null && minAmt > 0 && minAmt < floor;
    const hiBad = maxAmt != null && maxAmt > 0 && maxAmt < floor;
    if (loBad || hiBad || (ceil != null && ((minAmt != null && minAmt > ceil) || (maxAmt != null && maxAmt > ceil)))) {
      skipped += 1;
      await sb
        .from("sourcing_sourced_job_candidates")
        .update({
          publish_status: "skipped_not_eligible",
          publish_notes: `Skipped: implausible salary for period=${period} (min=${minAmt ?? "—"}, max=${maxAmt ?? "—"}).`,
        })
        .eq("id", candidate.id);
      results.push({ candidateId: candidate.id, status: "skipped", reason: "implausible_salary" });
      continue;
    }
  }

    const now = Date.now();
    const timestamp = candidate.posted_at ? Date.parse(candidate.posted_at) : now;
    const salaryText = formatSalaryForStorage(
      (candidate.salary_text_raw || "").trim() ||
        (minAmt || maxAmt
          ? `${candidate.salary_currency ?? ""} ${minAmt ?? ""}-${maxAmt ?? ""} ${candidate.salary_period ?? ""}`.trim()
          : ""),
    );

    const cleanedDescription = stripHtmlToText(
      ((candidate as any).description_raw || candidate.description_clean || "").toString(),
    ).trim();
    const formattedDescription = formatSourcedDescription(((candidate as any).description_raw || candidate.description_clean || "").toString());
    const category = inferCategory(candidate);
    if (
      !isOnNicheJob({
        title: candidate.title,
        category,
        description: formattedDescription || cleanedDescription,
      })
    ) {
      skipped += 1;
      await sb
        .from("sourcing_sourced_job_candidates")
        .update({
          publish_status: "skipped_not_eligible",
          publish_notes: "Skipped: outside CareersPal niche (Ops / Systems / Automation / RevOps / Product Ops / Chief of Staff).",
        })
        .eq("id", candidate.id);
      results.push({ candidateId: candidate.id, status: "skipped", reason: "off_niche" });
      continue;
    }
    const toolHits = extractTools(cleanedDescription);
    const emp = detectEmploymentType({
      title: candidate.title,
      description: formattedDescription || cleanedDescription,
      locationText: candidate.location_text,
      remotePolicy: candidate.remote_policy,
    });
    const notion = detectNotionSignal({ title: candidate.title, description: formattedDescription || cleanedDescription, tools: toolHits });
    const keywords = notion.notion_heavy ? "notion-heavy" : null;

    // For parity with manual admin posts, copy safe company fields onto the job row as well.
    // (Company pages can still render even if company record is sparse.)
    let companyForJob: { website?: string | null; logo_url?: string | null; description?: string | null } | null = null;
    try {
      const { data } = await sb.from("companies").select("website,logo_url,description").eq("id", companyId).maybeSingle();
      companyForJob = (data as any) || null;
    } catch {
      companyForJob = null;
    }

    const jobInsert = {
      company_id: companyId,
      title: (candidate.title || "").trim() || "Untitled role",
      description: formattedDescription || cleanedDescription || "",
      location: candidate.location_text || null,
      remote_policy:
        inferWorkMode({
          remotePolicy: candidate.remote_policy,
          location: candidate.location_text,
          description: formattedDescription || cleanedDescription,
        }) || candidate.remote_policy || null,
      type: emp.type || null,
      salary: salaryText || null,
      salary_min: minAmt || null,
      salary_max: maxAmt || null,
      salary_currency: candidate.salary_currency || null,
      posted_at_text: candidate.posted_at ? new Date(candidate.posted_at).toISOString().slice(0, 10) : "Just now",
      timestamp: Number.isFinite(timestamp) ? Math.floor(timestamp) : now,
      category,
      apply_url: applyUrl,
      company_description: (() => {
        const desc = (companyForJob?.description || "").toString().trim();
        if (!desc || isBoilerplateDescription(desc)) return null;
        return desc;
      })(),
      company_website: (() => {
        const raw = ((companyForJob?.website || "").toString().trim() || derivedCompanyWebsite || src?.companies?.website || "").trim();
        const lower = raw.toLowerCase();
        if (!raw) return null;
        if (lower.includes("greenhouse.io") || lower.includes("lever.co") || lower.includes("ashbyhq.com")) return null;
        return raw;
      })(),
      logo_url: (companyForJob?.logo_url || "").toString().trim() || src?.companies?.logo_url || derivedLogoUrl || null,
      tags: toolHits.length > 0 ? toolHits : null,
      tools: toolHits.length > 0 ? toolHits : null,
      benefits: null,
      keywords,
      match_score: null,
      is_featured: false,
      status: "published",
      created_by: actorId,
      published_at: new Date().toISOString(),
    };

    try {
      const { data: newJob, error: jErr } = await sb.from("jobs").insert(jobInsert).select("id").single();
      if (jErr || !newJob?.id) throw new Error("job_insert_failed");
      await sb.from("jobs").update({ origin: "greenhouse" }).eq("id", newJob.id);

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

