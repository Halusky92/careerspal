import type { SupabaseClient } from "@supabase/supabase-js";
import { isPaidEmployerJob, sourcedPublishBlockers, applyUrlWouldDuplicate, type CandidateRow } from "./syncPublishedJobs";
import { discoveryMarketBlockers } from "./discoveryPublishGate";
import { assessBoardFetchHealth, boardHealthReason, planBoardClosures, type BoardListing } from "../boardHealth";
import { isSourcedJobOrigin } from "../origin";
import { applyUrlLooksSourcedAts, probeApplyUrl } from "../../jobs/applyLinkHealth";

/** Statuses a nightly ATS refresh may publish again. pending_review and rejected stay put. */
export const SOURCED_REOPEN_STATUSES = ["closed", "archived", "paused"] as const;

type AdminSb = SupabaseClient<any, "public", any>;

type BoardJobRow = {
  id: string;
  status: string | null;
  origin?: string | null;
  apply_url?: string | null;
  plan_price?: number | null;
  stripe_payment_status?: string | null;
};

/** Missing jobs.origin is not an employer listing. Only a real employer signal is. */
export function boardCloseProtectsEmployer(
  job: {
    origin?: string | null;
    apply_url?: string | null;
    plan_price?: number | null;
    stripe_payment_status?: string | null;
  },
  publishStatus?: string | null,
  paymentKnown = true,
) {
  if (!paymentKnown) return true;
  if (publishStatus && publishStatus !== "auto_published") return true;
  if (isPaidEmployerJob(job)) return true;
  if (job.plan_price === 0 || job.stripe_payment_status === "founding") return true;
  if (job.origin && !isSourcedJobOrigin(job.origin)) return true;
  if (isSourcedJobOrigin(job.origin)) return false;
  if (publishStatus === "auto_published" && applyUrlLooksSourcedAts(job.apply_url)) return false;
  return true;
}

async function loadJobsForBoardClose(sb: AdminSb, jobIds: string[]) {
  const jobs: BoardJobRow[] = [];
  let paymentKnown = true;
  for (let i = 0; i < jobIds.length; i += 200) {
    const slice = jobIds.slice(i, i + 200);
    const first = await sb.from("jobs").select("id,status,origin,apply_url,plan_price,stripe_payment_status").in("id", slice);
    let data = ((first.data as BoardJobRow[] | null) || []) as BoardJobRow[];
    let error = first.error as { message?: string } | null;
    if (error && /origin/i.test(error.message || "")) {
      const second = await sb.from("jobs").select("id,status,apply_url,plan_price,stripe_payment_status").in("id", slice);
      data = ((second.data as BoardJobRow[] | null) || []) as BoardJobRow[];
      error = second.error;
    }
    if (error && /plan_price|stripe_payment_status/i.test(error.message || "")) {
      paymentKnown = false;
      const third = await sb.from("jobs").select("id,status").in("id", slice);
      data = ((third.data as BoardJobRow[] | null) || []) as BoardJobRow[];
      error = third.error;
    }
    if (error) throw new Error(error.message || "jobs_load_failed");
    jobs.push(...data);
  }
  return { jobs, paymentKnown };
}

export type IngestCloseSignal = {
  sourceId: string;
  runId?: string | null;
  status?: string | null;
  fetchedCount?: number;
  detailFailures?: number;
  error?: string | null;
  externalIds?: string[];
  timedOut?: boolean;
  incomplete?: boolean;
};

async function previousSuccessFetchedCount(sb: AdminSb, sourceId: string, excludeRunId?: string | null) {
  let q = sb
    .from("sourcing_source_runs")
    .select("id,fetched_count,status")
    .eq("source_id", sourceId)
    .eq("status", "success")
    .order("finished_at", { ascending: false })
    .limit(5);
  const { data } = await q;
  const rows = (data as Array<{ id: string; fetched_count: number | null }> | null) || [];
  const hit = rows.find((row) => row.id !== excludeRunId);
  return typeof hit?.fetched_count === "number" ? hit.fetched_count : null;
}

export async function closeJobsMissingFromBoard(sb: AdminSb, ingest: IngestCloseSignal) {
  const liveIds = (ingest.externalIds || []).map((id) => String(id));
  const previous = await previousSuccessFetchedCount(sb, ingest.sourceId, ingest.runId);
  const fetchedCount = Number(ingest.fetchedCount);
  const health = assessBoardFetchHealth({
    status: ingest.status,
    fetchedCount: Number.isFinite(fetchedCount) ? fetchedCount : liveIds.length,
    previousSuccessFetchedCount: previous,
    error: ingest.error,
    timedOut: ingest.timedOut,
    incomplete: ingest.incomplete,
    liveIdCount: Array.isArray(ingest.externalIds) ? liveIds.length : 0,
    detailFailures: ingest.detailFailures,
  });
  const empty = { breaker: boardHealthReason(health), closed: 0, reopened: 0, held: 0, missed: 0, seen: 0, skipped: 0 };
  if (!health.ok) return empty;

  const { data: candidates, error } = await sb
    .from("sourcing_sourced_job_candidates")
    .select(
      "id,external_job_id,published_job_id,missing_board_streak,missing_board_streak_at,publish_notes,publish_status,source_type,payload_hash,apply_url,title,location_text,remote_policy,posted_at,description_clean,description_raw,salary_text_raw,salary_amount_min,salary_amount_max,salary_currency,salary_period,salary_present,sourcing_candidate_scores(score_total),sourcing_candidate_decisions(decision,blocking_reason_codes)",
    )
    .eq("source_id", ingest.sourceId)
    .not("published_job_id", "is", null);
  if (error) {
    if (/missing_board_streak/i.test(error.message || "")) {
      return { ...empty, breaker: empty.breaker || "schema_unavailable" };
    }
    throw new Error("Unable to load published candidates for close-from-board.");
  }
  const rows = (candidates as Array<{
    id: string;
    external_job_id: string;
    published_job_id: string | null;
    missing_board_streak?: number | null;
    missing_board_streak_at?: string | null;
    publish_notes?: string | null;
    publish_status?: string | null;
  } & Partial<CandidateRow>> | null) || [];
  if (rows.length === 0) return empty;

  const jobIds = rows.map((row) => row.published_job_id).filter(Boolean) as string[];
  const { jobs, paymentKnown } = await loadJobsForBoardClose(sb, jobIds);
  const jobMap = new Map(jobs.map((job) => [job.id, job]));

  const listings: BoardListing[] = [];
  for (const row of rows) {
    if (!row.published_job_id) continue;
    const job = jobMap.get(row.published_job_id);
    if (!job) continue;
    listings.push({
      candidateId: row.id,
      jobId: job.id,
      externalJobId: String(row.external_job_id),
      streak: Number(row.missing_board_streak) || 0,
      jobStatus: job.status,
      closedByBoard: /closed_from_board/i.test(row.publish_notes || ""),
      paidEmployer: boardCloseProtectsEmployer(job, row.publish_status, paymentKnown),
      lastMissAt: row.missing_board_streak_at || null,
    });
  }

  const plan = planBoardClosures({ health, liveExternalIds: liveIds, listings });
  if (plan.breaker) return { ...empty, breaker: plan.breaker };
  const skipped = listings.filter((listing) => listing.paidEmployer).length;

  const now = new Date().toISOString();
  let closed = 0;
  let reopened = 0;
  let held = 0;
  let missed = 0;
  let seen = 0;
  const rowByCandidate = new Map(rows.map((row) => [row.id, row]));

  for (const action of plan.actions) {
    if (action.type === "wait") continue;
    if (action.type === "stamp") {
      await sb
        .from("sourcing_sourced_job_candidates")
        .update({ missing_board_streak_at: now })
        .eq("id", action.candidateId);
      missed += 1;
      continue;
    }
    if (action.type === "close") {
      const closedUpdate = await sb
        .from("jobs")
        .update({ status: "closed", unpublished_at: now })
        .eq("id", action.jobId)
        .eq("status", "published");
      if (closedUpdate.error && /check constraint|status/i.test(closedUpdate.error.message || "")) {
        const pausedUpdate = await sb
          .from("jobs")
          .update({ status: "paused", unpublished_at: now })
          .eq("id", action.jobId)
          .eq("status", "published");
        if (pausedUpdate.error) throw new Error(pausedUpdate.error.message);
      } else if (closedUpdate.error) {
        throw new Error(closedUpdate.error.message);
      }
      await sb
        .from("sourcing_sourced_job_candidates")
        .update({
          missing_board_streak: action.nextStreak,
          missing_board_streak_at: now,
          publish_status: "skipped_not_eligible",
          publish_notes: "closed_from_board: missing from consecutive healthy ATS fetches.",
        })
        .eq("id", action.candidateId);
      closed += 1;
      continue;
    }
    if (action.type === "reopen") {
      const candidate = rowByCandidate.get(action.candidateId);
      const blockers = candidate ? await reopenBlockers(sb, candidate, action.jobId) : ["candidate_missing"];
      if (blockers.length > 0) {
        await sb
          .from("jobs")
          .update({ status: "pending_review", unpublished_at: now, last_seen_at: now })
          .eq("id", action.jobId)
          .in("status", [...SOURCED_REOPEN_STATUSES]);
        await sb
          .from("sourcing_sourced_job_candidates")
          .update({
            missing_board_streak: 0,
            missing_board_streak_at: null,
            publish_status: "skipped_not_eligible",
            publish_notes: `held_on_reopen: ${blockers.join(",")}. timestamp unchanged.`,
            last_seen_at: now,
          })
          .eq("id", action.candidateId);
        held += 1;
        continue;
      }
      await sb
        .from("jobs")
        .update({ status: "published", unpublished_at: null, last_seen_at: now })
        .eq("id", action.jobId)
        .in("status", [...SOURCED_REOPEN_STATUSES]);
      await sb
        .from("sourcing_sourced_job_candidates")
        .update({
          missing_board_streak: 0,
          missing_board_streak_at: null,
          publish_status: "auto_published",
          publish_notes: "Reopened after the role returned on a healthy ATS fetch. timestamp unchanged.",
          last_seen_at: now,
        })
        .eq("id", action.candidateId);
      reopened += 1;
      continue;
    }
    if (action.type === "miss") {
      await sb
        .from("sourcing_sourced_job_candidates")
        .update({ missing_board_streak: action.nextStreak, missing_board_streak_at: now })
        .eq("id", action.candidateId);
      missed += 1;
      continue;
    }
    await sb
      .from("sourcing_sourced_job_candidates")
      .update({ missing_board_streak: 0, missing_board_streak_at: null, last_seen_at: now })
      .eq("id", action.candidateId);
    seen += 1;
  }

  return { breaker: null, closed, reopened, held, missed, seen, skipped };
}

async function reopenBlockers(sb: AdminSb, candidate: Partial<CandidateRow> & { id: string }, jobId: string) {
  const scoreTotal = Number(candidate.sourcing_candidate_scores?.score_total ?? 0);
  const decision = candidate.sourcing_candidate_decisions?.decision || null;
  const blockers = sourcedPublishBlockers(candidate as CandidateRow, scoreTotal, decision);
  for (const reason of discoveryMarketBlockers(candidate)) {
    if (!blockers.includes(reason)) blockers.push(reason);
  }
  const applyUrl = (candidate.apply_url || "").trim();
  const { data: job } = await sb.from("jobs").select("id,apply_url").eq("id", jobId).maybeSingle();
  const currentApply = ((job as { apply_url?: string | null } | null)?.apply_url || "").trim();
  if (applyUrl && applyUrl !== currentApply) {
    const { data: other } = await sb.from("jobs").select("id").eq("apply_url", applyUrl).neq("id", jobId).maybeSingle();
    if (applyUrlWouldDuplicate(applyUrl, currentApply, Boolean((other as { id?: string } | null)?.id))) {
      blockers.push("duplicate_apply_url");
    }
  }
  if (applyUrl && applyUrl !== "#") {
    const probe = await probeApplyUrl(applyUrl);
    if (probe.dead) blockers.push(`apply_dead:${probe.reason}`);
  }
  return blockers;
}
