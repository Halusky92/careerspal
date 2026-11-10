import { matchDenylistHost } from "../denylist";
import { getRegistrableDomain } from "../domain";
import { prepareDecision } from "../evaluation/decision";
import { scoreCandidate } from "../evaluation/scoring";
import { normalizeAshbyRawPayload } from "../normalization/ashby";
import { normalizeGreenhouseRawPayload, type NormalizedCandidate } from "../normalization/greenhouse";
import { normalizeLeverRawPayload } from "../normalization/lever";
import { sourcedPublishBlockers } from "../pipeline/syncPublishedJobs";
import { isOnNicheJob } from "../../nicheScope";
import { inferWorkMode } from "../../workMode";
import { extractOfficialBoards, isOfficialAtsHost, officialBoardUrl, type OfficialBoard } from "./atsLinks";
import { usMarketEligibility } from "./usMarket";

export const DISCOVERY_GREENHOUSE_DETAIL_CAP = 12;

export type DiscoveryFetcher = (url: string) => Promise<{ status: number; body: string }>;

export type DiscoveryLead = {
  companyName: string;
  website: string;
  careersUrl?: string | null;
  atsUrl?: string | null;
};

export type DiscoveryDecision = "pending_approval" | "rejected" | "held";

export type DiscoveryQualifyingJob = {
  title: string;
  applyUrl: string;
  location: string;
  remote: string;
  salary: string;
  score: number;
};

export type DiscoveryReview = {
  companyName: string;
  website: string;
  atsProvider: "greenhouse" | "ashby" | "lever" | null;
  atsIdentifier: string | null;
  boardUrl: string | null;
  openJobCount: number | null;
  qualifyingJobCount: number;
  qualifyingTitles: string[];
  qualifyingJobs: DiscoveryQualifyingJob[];
  sampledNicheJobs: number;
  unsampledNicheJobs: number;
  rejectionCounts: Record<string, number>;
  qualifyingApplyUrls: string[];
  decision: DiscoveryDecision;
  reason: string;
  enabled: false;
};

export type KnownDiscoverySource = {
  provider: string;
  identifier: string;
  website?: string | null;
};

type Identity = { provider: string; identifier: string; websiteHost: string };

function hostOf(value: string): string {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function websiteKey(website: string): string {
  return getRegistrableDomain(hostOf(website));
}

function emptyReview(lead: DiscoveryLead, reason: string, decision: DiscoveryDecision = "rejected"): DiscoveryReview {
  return {
    companyName: (lead.companyName || "").trim(),
    website: (lead.website || "").trim(),
    atsProvider: null,
    atsIdentifier: null,
    boardUrl: null,
    openJobCount: null,
    qualifyingJobCount: 0,
    qualifyingTitles: [],
    qualifyingJobs: [],
    sampledNicheJobs: 0,
    unsampledNicheJobs: 0,
    rejectionCounts: {},
    qualifyingApplyUrls: [],
    decision,
    reason,
    enabled: false,
  };
}

function pageUrls(lead: DiscoveryLead): string[] {
  const urls = [lead.careersUrl, lead.website]
    .map((value) => (value || "").trim())
    .filter(Boolean);
  const site = (lead.website || "").trim().replace(/\/+$/, "");
  if (site && !(lead.careersUrl || "").trim()) urls.push(`${site}/careers`);
  return [...new Set(urls)].slice(0, 2);
}

async function readBoardsFromPages(lead: DiscoveryLead, fetcher: DiscoveryFetcher): Promise<OfficialBoard[]> {
  const explicit = officialBoardUrl(lead.atsUrl || "");
  if (explicit) return extractOfficialBoards(explicit).slice(0, 2);
  const boards: OfficialBoard[] = [];
  for (const url of pageUrls(lead)) {
    let page: { status: number; body: string };
    try {
      page = await fetcher(url);
    } catch {
      continue;
    }
    if (page.status < 200 || page.status >= 300 || !page.body) continue;
    boards.push(...extractOfficialBoards(page.body));
    if (boards.length > 0) break;
  }
  const unique = new Map<string, OfficialBoard>();
  for (const board of boards) unique.set(`${board.provider}:${board.identifier.toLowerCase()}`, board);
  return [...unique.values()].slice(0, 2);
}

function assessJob(
  job: Omit<NormalizedCandidate, "source_type"> & { source_type: string },
  companyName: string,
): { qualifying: boolean; title: string; applyUrl: string; blockers: string[]; detail: DiscoveryQualifyingJob } {
  const scored = scoreCandidate({
    title: job.title,
    company_name: companyName,
    apply_url: job.apply_url,
    job_url: job.job_url,
    location_text: job.location_text,
    remote_policy: job.remote_policy,
    description_clean: job.description_clean,
    team_text: typeof job.provenance?.team_text === "string" ? job.provenance.team_text : null,
    salary_present: job.salary_present,
    source_type: job.source_type,
    source_validation_state: "allowed",
    source_enabled: true,
  });
  const decision = prepareDecision({
    score_total: scored.total,
    reasons: scored.reasons,
    salary_present: job.salary_present,
    duplicate_confidence: "none",
  });
  const blockers = sourcedPublishBlockers(
    {
      id: "discovery",
      source_id: "discovery",
      source_type: job.source_type,
      payload_hash: null,
      published_job_id: null,
      apply_url: job.apply_url,
      title: job.title,
      location_text: job.location_text,
      remote_policy: job.remote_policy,
      posted_at: job.posted_at,
      description_clean: job.description_clean,
      salary_text_raw: job.salary_text_raw,
      salary_amount_min: job.salary_amount_min,
      salary_amount_max: job.salary_amount_max,
      salary_currency: job.salary_currency,
      salary_period: job.salary_period,
      salary_present: job.salary_present,
      publish_status: null,
    },
    scored.total,
    decision.decision,
  );
  const geo = usMarketEligibility(job.location_text, job.remote_policy, job.description_clean);
  if (geo !== "us") blockers.push(geo === "outside_us" ? "outside_us" : "geo_unconfirmed");
  const mode = inferWorkMode({
    title: job.title,
    remotePolicy: job.remote_policy,
    location: job.location_text,
    description: job.description_clean,
  });
  if (mode === "Hybrid") blockers.push("hybrid_not_remote");
  const min = job.salary_amount_min;
  const max = job.salary_amount_max;
  const amount = min != null && max != null ? `${min}–${max}` : min != null ? String(min) : max != null ? String(max) : "";
  const salary = [job.salary_currency, amount, job.salary_period].filter(Boolean).join(" ") || (job.salary_text_raw || "").trim();
  return {
    qualifying: blockers.length === 0,
    title: (job.title || "").trim(),
    applyUrl: (job.apply_url || "").trim(),
    blockers,
    detail: {
      title: (job.title || "").trim(),
      applyUrl: (job.apply_url || "").trim(),
      location: (job.location_text || "").trim(),
      remote: (job.remote_policy || "").trim(),
      salary,
      score: scored.total,
    },
  };
}

function bump(counts: Record<string, number>, key: string) {
  counts[key] = (counts[key] || 0) + 1;
}

function primaryReason(blockers: string[]): string {
  const preferred = ["salary_missing", "salary_range_missing", "outside_us", "geo_unconfirmed", "onsite_only", "hybrid_not_remote", "description_thin", "apply_missing"];
  for (const key of preferred) {
    if (blockers.includes(key)) return key;
  }
  if (blockers.some((item) => item.startsWith("score_below_min"))) return "score_below_min";
  if (blockers.some((item) => item.startsWith("decision="))) return "not_auto_publish";
  return blockers[0] || "other";
}

async function loadJson(fetcher: DiscoveryFetcher, url: string): Promise<unknown | null> {
  try {
    const response = await fetcher(url);
    if (response.status < 200 || response.status >= 300) return null;
    return JSON.parse(response.body) as unknown;
  } catch {
    return null;
  }
}

async function measureBoard(
  board: OfficialBoard,
  companyName: string,
  fetcher: DiscoveryFetcher,
  options: { greenhouseUseContent?: boolean } = {},
): Promise<{
  available: boolean;
  openJobCount: number;
  qualifyingTitles: string[];
  qualifyingJobs: DiscoveryQualifyingJob[];
  qualifyingApplyUrls: string[];
  rejectionCounts: Record<string, number>;
  sampledNicheJobs: number;
  unsampledNicheJobs: number;
}> {
  const empty = {
    available: false,
    openJobCount: 0,
    qualifyingTitles: [] as string[],
    qualifyingJobs: [] as DiscoveryQualifyingJob[],
    qualifyingApplyUrls: [] as string[],
    rejectionCounts: {} as Record<string, number>,
    sampledNicheJobs: 0,
    unsampledNicheJobs: 0,
  };
  if (board.provider === "greenhouse") {
    const listUrl = options.greenhouseUseContent
      ? `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board.identifier)}/jobs?content=true`
      : `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board.identifier)}/jobs`;
    const list = (await loadJson(fetcher, listUrl)) as { jobs?: Array<{ id?: number; title?: string | null; content?: string | null }> } | null;
    if (!list || !Array.isArray(list.jobs)) return empty;
    const niche = list.jobs.filter((job) => typeof job.id === "number" && isOnNicheJob({ title: job.title || "", category: null }));
    const titles: string[] = [];
    const qualifyingJobs: DiscoveryQualifyingJob[] = [];
    const applyUrls: string[] = [];
    const rejectionCounts: Record<string, number> = {};
    rejectionCounts.off_niche_title = list.jobs.length - niche.length;
    if (rejectionCounts.off_niche_title === 0) delete rejectionCounts.off_niche_title;
    let sampled = 0;
    let unsampled = 0;
    const sample = options.greenhouseUseContent ? niche : niche.slice(0, DISCOVERY_GREENHOUSE_DETAIL_CAP);
    unsampled = Math.max(0, niche.length - sample.length);
    for (const job of sample) {
      const payload = options.greenhouseUseContent
        ? job
        : await loadJson(fetcher, `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board.identifier)}/jobs/${job.id}`);
      if (!payload || (options.greenhouseUseContent && !(job.content || "").trim())) {
        unsampled += 1;
        continue;
      }
      sampled += 1;
      const normalized = normalizeGreenhouseRawPayload({
        sourceUrl: board.boardUrl,
        externalJobId: String(job.id),
        companyName,
        rawPayload: payload,
      });
      const assessed = assessJob(normalized, companyName);
      if (assessed.qualifying && assessed.title) {
        titles.push(assessed.title);
        qualifyingJobs.push(assessed.detail);
        if (assessed.applyUrl) applyUrls.push(assessed.applyUrl);
      } else bump(rejectionCounts, primaryReason(assessed.blockers));
    }
    return {
      available: true,
      openJobCount: list.jobs.length,
      qualifyingTitles: titles,
      qualifyingJobs,
      qualifyingApplyUrls: applyUrls,
      rejectionCounts,
      sampledNicheJobs: sampled,
      unsampledNicheJobs: unsampled,
    };
  }

  const listUrl =
    board.provider === "ashby"
      ? `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board.identifier)}?includeCompensation=true`
      : `https://api.lever.co/v0/postings/${encodeURIComponent(board.identifier)}?mode=json`;
  const payload = await loadJson(fetcher, listUrl);
  const jobs = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { jobs?: unknown[] } | null)?.jobs)
      ? ((payload as { jobs: unknown[] }).jobs)
      : null;
  if (!jobs) return empty;
  const titles: string[] = [];
  const qualifyingJobs: DiscoveryQualifyingJob[] = [];
  const applyUrls: string[] = [];
  const rejectionCounts: Record<string, number> = {};
  let sampled = 0;
  for (const raw of jobs) {
    const record = (raw || {}) as { id?: string | number; title?: string | null; text?: string | null };
    const title = record.title || record.text || "";
    if (!isOnNicheJob({ title, category: null })) {
      bump(rejectionCounts, "off_niche_title");
      continue;
    }
    sampled += 1;
    const externalJobId = String(record.id || "");
    const normalized =
      board.provider === "ashby"
        ? normalizeAshbyRawPayload({ sourceUrl: board.boardUrl, externalJobId, companyName, rawPayload: raw })
        : normalizeLeverRawPayload({ sourceUrl: board.boardUrl, externalJobId, companyName, rawPayload: raw });
    const assessed = assessJob(normalized, companyName);
    if (assessed.qualifying && assessed.title) {
      titles.push(assessed.title);
      qualifyingJobs.push(assessed.detail);
      if (assessed.applyUrl) applyUrls.push(assessed.applyUrl);
    } else bump(rejectionCounts, primaryReason(assessed.blockers));
  }
  return {
    available: true,
    openJobCount: jobs.length,
    qualifyingTitles: titles,
    qualifyingJobs,
    qualifyingApplyUrls: applyUrls,
    rejectionCounts,
    sampledNicheJobs: sampled,
    unsampledNicheJobs: 0,
  };
}

export async function reviewDiscoveryLead(
  lead: DiscoveryLead,
  fetcher: DiscoveryFetcher,
  known: Identity[],
  options: { greenhouseUseContent?: boolean } = {},
): Promise<DiscoveryReview> {
  const companyName = (lead.companyName || "").trim();
  const website = (lead.website || "").trim();
  if (!companyName) return emptyReview(lead, "missing_company_name");
  if (!website || !hostOf(website)) return emptyReview(lead, "invalid_website");
  if (matchDenylistHost(hostOf(website)).matched) return emptyReview(lead, "aggregator");

  const siteKey = isOfficialAtsHost(hostOf(website)) ? "" : websiteKey(website);
  if (siteKey && known.some((item) => item.websiteHost === siteKey)) {
    return emptyReview(lead, "duplicate_company");
  }

  const boards = await readBoardsFromPages(lead, fetcher);
  if (boards.length === 0) return emptyReview(lead, "no_official_ats");

  let best: DiscoveryReview | null = null;
  for (const board of boards) {
    const key = `${board.provider}:${board.identifier.toLowerCase()}`;
    if (known.some((item) => `${item.provider}:${item.identifier.toLowerCase()}` === key)) {
      known.push({ provider: board.provider, identifier: board.identifier, websiteHost: siteKey });
      return {
        ...emptyReview(lead, "duplicate_source"),
        atsProvider: board.provider,
        atsIdentifier: board.identifier,
        boardUrl: board.boardUrl,
      };
    }
    const measured = await measureBoard(board, companyName, fetcher, options);
    known.push({ provider: board.provider, identifier: board.identifier, websiteHost: siteKey });
    if (!measured.available) {
      best = {
        ...emptyReview(lead, "ats_unavailable"),
        atsProvider: board.provider,
        atsIdentifier: board.identifier,
        boardUrl: board.boardUrl,
        openJobCount: null,
      };
      continue;
    }
    const qualifying = measured.qualifyingTitles.length;
    let decision: DiscoveryDecision = "rejected";
    let reason = "no_qualifying_jobs";
    if (measured.openJobCount === 0) reason = "no_open_jobs";
    else if (qualifying > 0) {
      decision = "pending_approval";
      reason = `pending_approval: ${qualifying} of ${measured.openJobCount} open jobs meet salary, remote, US, and niche rules`;
    } else if (measured.unsampledNicheJobs > 0) {
      decision = "held";
      reason = "sample_inconclusive";
    }
    const review: DiscoveryReview = {
      companyName,
      website,
      atsProvider: board.provider,
      atsIdentifier: board.identifier,
      boardUrl: board.boardUrl,
      openJobCount: measured.openJobCount,
      qualifyingJobCount: qualifying,
      qualifyingTitles: measured.qualifyingTitles.slice(0, 8),
      qualifyingJobs: measured.qualifyingJobs,
      qualifyingApplyUrls: measured.qualifyingApplyUrls,
      rejectionCounts: measured.rejectionCounts,
      sampledNicheJobs: measured.sampledNicheJobs,
      unsampledNicheJobs: measured.unsampledNicheJobs,
      decision,
      reason,
      enabled: false,
    };
    if (!best || review.qualifyingJobCount > best.qualifyingJobCount) best = review;
    if (review.decision === "pending_approval") break;
  }
  return best || emptyReview(lead, "no_official_ats");
}

export async function reviewDiscoveryBatch(
  leads: DiscoveryLead[],
  fetcher: DiscoveryFetcher,
  args: { limit?: number; knownSources?: KnownDiscoverySource[]; greenhouseUseContent?: boolean } = {},
): Promise<DiscoveryReview[]> {
  const limit = Math.max(1, Math.min(25, Number(args.limit) || 10));
  const known: Identity[] = (args.knownSources || []).map((source) => ({
    provider: source.provider,
    identifier: source.identifier,
    websiteHost: websiteKey(source.website || ""),
  }));
  const reviews: DiscoveryReview[] = [];
  for (const lead of leads.slice(0, limit)) {
    reviews.push(await reviewDiscoveryLead(lead, fetcher, known, { greenhouseUseContent: args.greenhouseUseContent }));
  }
  return reviews;
}

/** Row shape for sourcing_sources. Discovery never enables or approves a source. */
export function toPendingSourceRow(review: DiscoveryReview) {
  if (review.decision !== "pending_approval" || !review.boardUrl || !review.atsProvider || !review.atsIdentifier) return null;
  return {
    display_name: review.companyName,
    base_url: review.boardUrl,
    normalized_url: review.boardUrl.replace(/\/+$/, ""),
    source_type: review.atsProvider,
    ats_identifier: review.atsIdentifier,
    validation_state: "allowed_needs_review" as const,
    validation_confidence: "high" as const,
    enabled: false as const,
    approval_decision: null,
    approval_notes: `${review.reason}. Open ${review.openJobCount}. Qualifying ${review.qualifyingJobCount}.`,
  };
}
