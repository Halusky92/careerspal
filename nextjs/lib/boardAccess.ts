export const GUEST_VISIBLE_JOBS = 4;
export const REGISTERED_VISIBLE_JOBS = 14;
export const REGISTERED_SAVED_SEARCHES = 1;
export const BOARD_PREMIUM_PRICE = 7.99;

export type BoardTier = "guest" | "registered" | "paid";

export function boardCap(tier: BoardTier): number | null {
  if (tier === "paid") return null;
  if (tier === "registered") return REGISTERED_VISIBLE_JOBS;
  return GUEST_VISIBLE_JOBS;
}

export function resolveBoardTier(input: {
  signedIn?: boolean;
  role?: string | null;
  premiumUntil?: string | null;
}): BoardTier {
  if (input.role === "admin") return "paid";
  const until = input.premiumUntil ? Date.parse(input.premiumUntil) : 0;
  if (Number.isFinite(until) && until > Date.now()) return "paid";
  if (input.signedIn) return "registered";
  return "guest";
}

export const PAID_JOBS_PAGE_MAX = 50;

export function applyBoardVisibility<T extends { timestamp?: number | null }>(jobs: T[], cap: number | null): T[] {
  const sorted = [...jobs].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
  if (cap == null) return sorted;
  return sorted.slice(0, Math.max(0, cap));
}

export function paginateBoardJobs<T extends { timestamp?: number | null }>(
  jobs: T[],
  opts: { cap: number | null; skip?: number; limit?: number },
): { jobs: T[]; total: number; visible: number } {
  const ranked = applyBoardVisibility(jobs, null);
  const total = ranked.length;
  if (opts.cap != null) {
    const visibleJobs = ranked.slice(0, opts.cap);
    return { jobs: visibleJobs, total, visible: visibleJobs.length };
  }
  const skip = Number.isFinite(opts.skip) && (opts.skip || 0) > 0 ? Math.floor(opts.skip || 0) : 0;
  const requested = Number.isFinite(opts.limit) && (opts.limit || 0) > 0 ? Math.floor(opts.limit || 0) : PAID_JOBS_PAGE_MAX;
  const limit = Math.min(PAID_JOBS_PAGE_MAX, Math.max(1, requested));
  const page = ranked.slice(skip, skip + limit);
  return { jobs: page, total, visible: page.length };
}

export function jobRank(jobs: Array<{ id: string; timestamp?: number | null }>, jobId: string): number {
  return applyBoardVisibility(jobs, null).findIndex((job) => job.id === jobId);
}

export function boardPageForTier<T extends { timestamp?: number | null }>(
  jobs: T[],
  tier: BoardTier,
  opts: { skip?: number; limit?: number },
) {
  const page = paginateBoardJobs(jobs, { cap: boardCap(tier), skip: opts.skip, limit: opts.limit });
  return { ...page, access: tier };
}

export function jobVisibleAtRank(rank: number, cap: number | null): boolean {
  if (rank < 0) return false;
  if (cap == null) return true;
  return rank < cap;
}
