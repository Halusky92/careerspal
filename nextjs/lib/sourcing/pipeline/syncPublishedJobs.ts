import type { SupabaseClient } from "@supabase/supabase-js";
import { getSourcingAutoPublishMinScore, getSourcingAutoPublishSupportedSourceTypes } from "../config";
import { formatSourcedDescription } from "../normalization/description";
import { stripHtmlToText } from "../normalization/text";
import { detectEmploymentType } from "../normalization/employmentType";
import { formatSalaryForStorage } from "../../formatSalary";
import { roundSalaryAmount, type SalaryPeriod } from "../normalization/salary";
import { isOnNicheJob } from "../../nicheScope";
import { discoveryMarketBlockers } from "./discoveryPublishGate";
import { inferWorkMode } from "../../workMode";
import { resolveCategoryHub } from "../../categories";
import { applyUrlLooksSourcedAts, probeApplyUrl } from "../../jobs/applyLinkHealth";
import { isSourcedJobOrigin, sourcedOriginFromSourceType } from "../origin";

type AdminSb = SupabaseClient<any, "public", any>;

export type CandidateRow = {
  id: string;
  source_id: string;
  source_type: string;
  payload_hash: string | null;
  published_job_id: string | null;
  apply_url: string | null;
  title: string | null;
  location_text: string | null;
  remote_policy: string | null;
  posted_at: string | null;
  description_clean: string | null;
  description_raw?: string | null;
  salary_text_raw: string | null;
  salary_amount_min: number | null;
  salary_amount_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  salary_present: boolean;
  publish_status: string | null;
  sourcing_candidate_scores?: { score_total?: number } | null;
  sourcing_candidate_decisions?: { decision?: string; blocking_reason_codes?: string[] } | null;
};

export function isPaidEmployerJob(row: {
  origin?: string | null;
  plan_price?: number | null;
  stripe_payment_status?: string | null;
}) {
  if (isSourcedJobOrigin(row.origin)) return false;
  return (typeof row.plan_price === "number" && row.plan_price > 0) || row.stripe_payment_status === "paid";
}

export function applyUrlWouldDuplicate(nextApply: string, currentApply: string, otherJobOwnsUrl: boolean) {
  const next = (nextApply || "").trim();
  const current = (currentApply || "").trim();
  if (!next || next === current) return false;
  return otherJobOwnsUrl;
}

export function buildSourcedJobContentPatch(
  candidate: CandidateRow,
  args: { applyUrl: string; lastSeenAt: string },
) {
  const periodKey = ((candidate.salary_period || "year") as SalaryPeriod) || "year";
  const minAmt = typeof candidate.salary_amount_min === "number" ? roundSalaryAmount(candidate.salary_amount_min, periodKey) : null;
  const maxAmt = typeof candidate.salary_amount_max === "number" ? roundSalaryAmount(candidate.salary_amount_max, periodKey) : null;
  const cleanedDescription = stripHtmlToText(
    (candidate.description_raw || candidate.description_clean || "").toString(),
  ).trim();
  const formattedDescription = formatSourcedDescription((candidate.description_raw || candidate.description_clean || "").toString());
  const emp = detectEmploymentType({
    title: candidate.title,
    description: formattedDescription || cleanedDescription,
    locationText: candidate.location_text,
    remotePolicy: candidate.remote_policy,
  });
  const salaryText = formatSalaryForStorage(
    (candidate.salary_text_raw || "").trim() ||
      (minAmt || maxAmt
        ? `${candidate.salary_currency ?? ""} ${minAmt ?? ""}-${maxAmt ?? ""} ${candidate.salary_period ?? ""}`.trim()
        : ""),
  );
  return {
    title: (candidate.title || "").trim() || undefined,
    description: formattedDescription || cleanedDescription || undefined,
    location: candidate.location_text || null,
    remote_policy:
      inferWorkMode({
        title: candidate.title,
        remotePolicy: candidate.remote_policy,
        location: candidate.location_text,
        description: formattedDescription || cleanedDescription,
      }) || candidate.remote_policy || null,
    type: emp.type || null,
    salary: salaryText || null,
    salary_min: minAmt,
    salary_max: maxAmt,
    salary_currency: candidate.salary_currency || null,
    apply_url: args.applyUrl,
    origin: sourcedOriginFromSourceType(candidate.source_type),
    content_hash: candidate.payload_hash,
    last_seen_at: args.lastSeenAt,
  };
}

export function sourcedPublishBlockers(candidate: CandidateRow, scoreTotal: number, decision: string | null) {
  const reasons: string[] = [];
  const minScore = getSourcingAutoPublishMinScore();
  const supported = getSourcingAutoPublishSupportedSourceTypes();
  if (decision && decision !== "auto_publish_candidate") reasons.push(`decision=${decision}`);
  if (!(scoreTotal >= minScore)) reasons.push(`score_below_min(${scoreTotal}<${minScore})`);
  if (candidate.salary_present !== true) reasons.push("salary_missing");
  if (candidate.salary_amount_min == null && candidate.salary_amount_max == null) reasons.push("salary_range_missing");
  const applyUrl = (candidate.apply_url || "").trim();
  if (!applyUrl || applyUrl === "#") reasons.push("apply_missing");
  if (((candidate.description_clean || "").trim().length) < 280) reasons.push("description_thin");
  if (!supported.has((candidate.source_type || "").toLowerCase())) {
    reasons.push(`source_unsupported(${candidate.source_type || "null"})`);
  }
  const workMode = inferWorkMode({
    title: candidate.title,
    remotePolicy: candidate.remote_policy,
    location: candidate.location_text,
    description: candidate.description_clean,
  });
  if (workMode === "Onsite") reasons.push("onsite_only");
  if (
    !isOnNicheJob({
      title: candidate.title,
      category: resolveCategoryHub({ title: candidate.title, category: null })?.dbCategories[0] || null,
      description: candidate.description_clean,
    })
  ) {
    reasons.push("off_niche_title");
  }
  return reasons;
}

export function omitMissingJobColumns(patch: Record<string, unknown>, message: string) {
  const next = { ...patch };
  let removed = false;
  for (const column of ["origin", "content_hash", "last_seen_at"] as const) {
    if (column in next && new RegExp(column, "i").test(message)) {
      delete next[column];
      removed = true;
    }
  }
  return removed ? next : null;
}

async function patchJob(sb: AdminSb, jobId: string, patch: Record<string, unknown>) {
  let payload = { ...patch };
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const result = await sb.from("jobs").update(payload).eq("id", jobId);
    if (!result.error) return;
    const next = omitMissingJobColumns(payload, result.error.message || "");
    if (!next) throw new Error(result.error.message || "job_patch_failed");
    payload = next;
  }
  throw new Error("job_patch_failed");
}

async function loadJobForSync(sb: AdminSb, jobId: string) {
  const first = await sb
    .from("jobs")
    .select("id,origin,plan_price,stripe_payment_status,apply_url,content_hash,status")
    .eq("id", jobId)
    .maybeSingle();
  if (!first.error) return first.data;
  const message = first.error.message || "";
  if (!/origin|content_hash/i.test(message)) return null;
  const second = await sb
    .from("jobs")
    .select("id,plan_price,stripe_payment_status,apply_url,content_hash,status")
    .eq("id", jobId)
    .maybeSingle();
  if (!second.error) return second.data;
  if (!/content_hash/i.test(second.error.message || "")) return null;
  const third = await sb
    .from("jobs")
    .select("id,plan_price,stripe_payment_status,apply_url,status")
    .eq("id", jobId)
    .maybeSingle();
  return third.error ? null : third.data;
}

export async function syncPublishedSourcedJobs(
  sb: AdminSb,
  args: { sourceId?: string | null; limit?: number },
) {
  const sourceId = (args.sourceId || "").trim();
  const limit = Math.min(200, Math.max(1, Number(args.limit) || 80));
  let q = sb
    .from("sourcing_sourced_job_candidates")
    .select(
      "id,source_id,source_type,payload_hash,published_job_id,apply_url,title,location_text,remote_policy,posted_at,description_clean,description_raw,salary_text_raw,salary_amount_min,salary_amount_max,salary_currency,salary_period,salary_present,publish_status," +
        "sourcing_candidate_scores(score_total)," +
        "sourcing_candidate_decisions(decision,blocking_reason_codes)",
    )
    .not("published_job_id", "is", null)
    .eq("publish_status", "auto_published")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (sourceId) q = q.eq("source_id", sourceId);

  const { data, error } = await q;
  if (error) throw new Error("Unable to load published candidates.");
  const rows = ((data as unknown as CandidateRow[] | null) || []);
  const now = new Date().toISOString();
  let unchanged = 0;
  let updated = 0;
  let held = 0;
  let skippedPaid = 0;

  for (const candidate of rows) {
    const jobId = candidate.published_job_id;
    if (!jobId) continue;
    const job = await loadJobForSync(sb, jobId);
    const jobRow = job as {
      id: string;
      origin?: string | null;
      plan_price?: number | null;
      stripe_payment_status?: string | null;
      apply_url?: string | null;
      content_hash?: string | null;
      status?: string | null;
    } | null;
    if (!jobRow?.id) continue;
    if (isPaidEmployerJob(jobRow) || jobRow.plan_price === 0 || jobRow.stripe_payment_status === "founding") {
      skippedPaid += 1;
      continue;
    }
    const atsShape =
      isSourcedJobOrigin(jobRow.origin) ||
      applyUrlLooksSourcedAts(jobRow.apply_url) ||
      applyUrlLooksSourcedAts(candidate.apply_url);
    if (!atsShape) continue;

    if (jobRow.content_hash && candidate.payload_hash && jobRow.content_hash === candidate.payload_hash) {
      await patchJob(sb, jobRow.id, { last_seen_at: now });
      await sb.from("sourcing_sourced_job_candidates").update({ last_seen_at: now }).eq("id", candidate.id);
      unchanged += 1;
      continue;
    }

    const scoreTotal = Number(candidate.sourcing_candidate_scores?.score_total ?? 0);
    const decision = candidate.sourcing_candidate_decisions?.decision || null;
    const blockers = sourcedPublishBlockers(candidate, scoreTotal, decision);
    for (const reason of discoveryMarketBlockers(candidate)) {
      if (!blockers.includes(reason)) blockers.push(reason);
    }
    const applyUrl = (candidate.apply_url || "").trim();
    if (applyUrl && applyUrl !== (jobRow.apply_url || "").trim()) {
      const { data: other } = await sb.from("jobs").select("id").eq("apply_url", applyUrl).neq("id", jobRow.id).maybeSingle();
      if (applyUrlWouldDuplicate(applyUrl, jobRow.apply_url || "", Boolean(other?.id))) {
        blockers.push("duplicate_apply_url");
      }
    }
    if (applyUrl && applyUrl !== "#") {
      const probe = await probeApplyUrl(applyUrl);
      if (probe.dead) blockers.push(`apply_dead:${probe.reason}`);
    }

    if (blockers.length > 0) {
      await patchJob(sb, jobRow.id, {
        status: "pending_review",
        unpublished_at: now,
        content_hash: candidate.payload_hash,
        last_seen_at: now,
      });
      await sb
        .from("sourcing_sourced_job_candidates")
        .update({
          last_seen_at: now,
          publish_status: "skipped_not_eligible",
          publish_notes: `Held after freshness re-eval. ${blockers.join("; ")}`,
        })
        .eq("id", candidate.id);
      held += 1;
      continue;
    }

    await patchJob(sb, jobRow.id, buildSourcedJobContentPatch(candidate, { applyUrl, lastSeenAt: now }));
    await sb
      .from("sourcing_sourced_job_candidates")
      .update({
        last_seen_at: now,
        publish_status: "auto_published",
        publish_notes: "Updated in place after payload hash change. timestamp unchanged.",
      })
      .eq("id", candidate.id);
    updated += 1;
  }

  return { processed: rows.length, unchanged, updated, held, skippedPaid };
}
