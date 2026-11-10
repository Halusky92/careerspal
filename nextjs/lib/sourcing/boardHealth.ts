export const CLOSE_STREAK_REQUIRED = 2;
export const CLOSE_CONFIRM_GAP_MS = 12 * 60 * 60 * 1000;
export const FETCH_COLLAPSE_RATIO = 0.5;
export const MIN_PREV_FETCH_TO_COMPARE = 2;

export type BoardHealth = { ok: true } | { ok: false; reason: string };

export function boardHealthReason(health: BoardHealth): string | null {
  return health.ok ? null : health.reason;
}

const UPSTREAM =
  /\b(429|500|502|503|504|rate limit|too many requests|timeout|etimedout|econnreset|enotfound|fetch failed)\b/i;

export function isUpstreamFetchError(error?: string | null) {
  return Boolean(error && UPSTREAM.test(error));
}

export function assessBoardFetchHealth(args: {
  status?: string | null;
  fetchedCount: number;
  previousSuccessFetchedCount?: number | null;
  error?: string | null;
  timedOut?: boolean;
  incomplete?: boolean;
  liveIdCount?: number;
  detailFailures?: number;
}): BoardHealth {
  if (args.timedOut) return { ok: false, reason: "timeout" };
  if (isUpstreamFetchError(args.error)) return { ok: false, reason: "upstream_error" };
  if ((args.status || "") === "failed") return { ok: false, reason: "ingest_failed" };
  if ((args.detailFailures || 0) > 0) return { ok: false, reason: "incomplete_response" };
  if (args.status && args.status !== "success") return { ok: false, reason: "incomplete_response" };
  if (args.incomplete) return { ok: false, reason: "incomplete_response" };
  if (!Number.isFinite(args.fetchedCount) || args.fetchedCount < 0) {
    return { ok: false, reason: "invalid_count" };
  }
  if (typeof args.liveIdCount === "number") {
    if (args.fetchedCount > 0 && args.liveIdCount === 0) return { ok: false, reason: "incomplete_response" };
    if (args.fetchedCount > 0 && args.liveIdCount !== args.fetchedCount) {
      return { ok: false, reason: "incomplete_response" };
    }
  }
  if (args.fetchedCount === 0) {
    if ((args.previousSuccessFetchedCount || 0) > 0) return { ok: false, reason: "empty_after_nonempty" };
    return { ok: false, reason: "empty_fetch" };
  }
  const prev = args.previousSuccessFetchedCount;
  if (typeof prev === "number" && prev >= MIN_PREV_FETCH_TO_COMPARE) {
    if (args.fetchedCount < prev * FETCH_COLLAPSE_RATIO) return { ok: false, reason: "count_collapse" };
  }
  return { ok: true };
}

export type BoardListing = {
  candidateId: string;
  jobId: string;
  externalJobId: string;
  streak: number;
  jobStatus: string | null;
  closedByBoard: boolean;
  paidEmployer: boolean;
  lastMissAt?: string | null;
};

export type BoardCloseAction = {
  type: "close" | "reopen" | "miss" | "seen" | "wait" | "stamp";
  candidateId: string;
  jobId: string;
  nextStreak: number;
};

export function planBoardClosures(args: {
  health: BoardHealth;
  liveExternalIds: string[];
  listings: BoardListing[];
  requiredStreak?: number;
  nowMs?: number;
  minGapMs?: number;
}): { breaker: string | null; actions: BoardCloseAction[] } {
  if (!args.health.ok) return { breaker: args.health.reason, actions: [] };
  const seen = new Set(args.liveExternalIds.map((id) => String(id)));
  const required = args.requiredStreak ?? CLOSE_STREAK_REQUIRED;
  const nowMs = args.nowMs ?? Date.now();
  const minGapMs = args.minGapMs ?? CLOSE_CONFIRM_GAP_MS;
  const actions: BoardCloseAction[] = [];
  for (const listing of args.listings) {
    if (listing.paidEmployer) continue;
    if (seen.has(String(listing.externalJobId))) {
      if (listing.closedByBoard && (listing.jobStatus === "closed" || listing.jobStatus === "archived")) {
        actions.push({ type: "reopen", candidateId: listing.candidateId, jobId: listing.jobId, nextStreak: 0 });
      } else {
        actions.push({ type: "seen", candidateId: listing.candidateId, jobId: listing.jobId, nextStreak: 0 });
      }
      continue;
    }
    const lastMissMs = listing.lastMissAt ? Date.parse(listing.lastMissAt) : NaN;
    if (listing.streak <= 0) {
      actions.push({ type: "miss", candidateId: listing.candidateId, jobId: listing.jobId, nextStreak: 1 });
      continue;
    }
    if (!Number.isFinite(lastMissMs)) {
      actions.push({ type: "stamp", candidateId: listing.candidateId, jobId: listing.jobId, nextStreak: listing.streak });
      continue;
    }
    if (nowMs - lastMissMs < minGapMs) {
      actions.push({ type: "wait", candidateId: listing.candidateId, jobId: listing.jobId, nextStreak: listing.streak });
      continue;
    }
    const nextStreak = listing.streak + 1;
    actions.push({
      type: nextStreak >= required ? "close" : "miss",
      candidateId: listing.candidateId,
      jobId: listing.jobId,
      nextStreak,
    });
  }
  return { breaker: null, actions };
}
