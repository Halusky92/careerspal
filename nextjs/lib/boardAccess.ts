export function boardCapsEnabled(flag = process.env.BOARD_PREMIUM_CAPS) {
  return flag === "1";
}

export function premiumCheckoutAllowed(stripeKey?: string | null) {
  return (stripeKey || "").startsWith("sk_test_");
}

type PremiumEnv = {
  STRIPE_PREMIUM_SECRET_KEY?: string;
  STRIPE_SECRET_KEY?: string;
  PREMIUM_LIVE?: string;
  PREMIUM_CHECKOUT?: string;
  PREMIUM_LIVE_EMAIL?: string;
  STRIPE_PREMIUM_PRICE_ID?: string;
  STRIPE_BOARD_PRICE_ID?: string;
};

function premiumEnv(env?: PremiumEnv): PremiumEnv {
  if (env) return env;
  return {
    STRIPE_PREMIUM_SECRET_KEY: process.env.STRIPE_PREMIUM_SECRET_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    PREMIUM_LIVE: process.env.PREMIUM_LIVE,
    PREMIUM_CHECKOUT: process.env.PREMIUM_CHECKOUT,
    PREMIUM_LIVE_EMAIL: process.env.PREMIUM_LIVE_EMAIL,
    STRIPE_PREMIUM_PRICE_ID: process.env.STRIPE_PREMIUM_PRICE_ID,
    STRIPE_BOARD_PRICE_ID: process.env.STRIPE_BOARD_PRICE_ID,
  };
}

/** Live Premium uses its own key. The shared employer key is used only while it is still a test key. */
export function resolvePremiumStripeKey(env?: PremiumEnv) {
  env = premiumEnv(env);
  const dedicated = (env.STRIPE_PREMIUM_SECRET_KEY || "").trim();
  const shared = (env.STRIPE_SECRET_KEY || "").trim();
  if (dedicated.startsWith("sk_live_") && env.PREMIUM_LIVE === "1") return dedicated;
  if (dedicated.startsWith("sk_test_")) return dedicated;
  if (shared.startsWith("sk_test_")) return shared;
  return "";
}

export function premiumCheckoutOpen(
  flag = process.env.PREMIUM_CHECKOUT,
  stripeKey = process.env.STRIPE_SECRET_KEY,
  liveFlag = process.env.PREMIUM_LIVE,
) {
  if (flag !== "1") return false;
  if ((stripeKey || "").startsWith("sk_test_")) return true;
  return (stripeKey || "").startsWith("sk_live_") && liveFlag === "1";
}

/** Live checkout requires the server-verified signed-in email. Test checkout stays open for staging. */
export function premiumLiveBuyerAllowed(
  email: string | null | undefined,
  stripeKey: string | null | undefined,
) {
  if (!(stripeKey || "").startsWith("sk_live_")) return true;
  return Boolean((email || "").trim());
}

const ACTIVE_PREMIUM_SUBSCRIPTION = new Set(["active", "trialing", "past_due"]);

/** A second checkout must not open while this account already has a live Premium subscription. */
export function premiumSubscriptionBlocksNewCheckout(statuses: Array<string | null | undefined>) {
  return statuses.some((status) => ACTIVE_PREMIUM_SUBSCRIPTION.has((status || "").trim()));
}

export function premiumPriceIdForKey(stripeKey: string, env?: PremiumEnv) {
  env = premiumEnv(env);
  if (stripeKey.startsWith("sk_live_")) return (env.STRIPE_PREMIUM_PRICE_ID || "").trim();
  return (env.STRIPE_BOARD_PRICE_ID || "").trim();
}

export function premiumPriceIsMonthly799(price: {
  unit_amount?: number | null;
  currency?: string | null;
  active?: boolean | null;
  recurring?: { interval?: string | null } | null;
}) {
  return price.unit_amount === 799 && price.currency === "usd" && price.recurring?.interval === "month" && price.active !== false;
}

export function stripeKeyForEventMode(livemode: boolean, env?: PremiumEnv) {
  env = premiumEnv(env);
  const premium = (env.STRIPE_PREMIUM_SECRET_KEY || "").trim();
  const shared = (env.STRIPE_SECRET_KEY || "").trim();
  if (livemode && premium.startsWith("sk_live_")) return premium;
  return shared;
}

export function stripeKeyForCheckoutSession(sessionId: string, env?: PremiumEnv) {
  env = premiumEnv(env);
  const premium = (env.STRIPE_PREMIUM_SECRET_KEY || "").trim();
  const shared = (env.STRIPE_SECRET_KEY || "").trim();
  if (sessionId.startsWith("cs_live_") && premium.startsWith("sk_live_")) return premium;
  return shared;
}

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

/** Company and category lists ignore the board-wide caps switch. No session stays guest. */
export function tierForPublicList(input: {
  signedIn?: boolean;
  role?: string | null;
  premiumUntil?: string | null;
  subscriptionStatus?: string | null;
}): BoardTier {
  if (!input.signedIn) return "guest";
  if (input.role === "admin") return "paid";
  const fromUntil = resolveBoardTier({
    signedIn: true,
    role: input.role,
    premiumUntil: input.premiumUntil,
  });
  if (fromUntil === "paid") return "paid";
  const status = input.subscriptionStatus || "";
  if ((status === "active" || status === "trialing") && !input.premiumUntil) return "paid";
  return fromUntil;
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

/** Titles shown behind the lock. Apply links and descriptions stay on the open rows only. */
export type LockedBoardPreview = {
  id: string;
  title: string;
  company: string;
  location: string;
  category: string;
  remotePolicy: string;
};

export function lockedBoardPreviews<
  T extends {
    id: string;
    title?: string | null;
    company?: string | null;
    location?: string | null;
    category?: string | null;
    remotePolicy?: string | null;
    timestamp?: number | null;
  },
>(jobs: T[], cap: number | null): LockedBoardPreview[] {
  if (cap == null) return [];
  return applyBoardVisibility(jobs, null)
    .slice(Math.max(0, cap))
    .map((job) => ({
      id: job.id,
      title: (job.title || "").trim() || "Role",
      company: (job.company || "").trim() || "Company",
      location: (job.location || "").trim() || "Remote",
      category: (job.category || "").trim(),
      remotePolicy: (job.remotePolicy || "").trim(),
    }));
}

export function boardCompanyCount(jobs: Array<{ company?: string | null }>) {
  return new Set(jobs.map((job) => (job.company || "").trim()).filter(Boolean)).size;
}

/** Full live-board total. The jobs API returns at most one page, so the homepage must not count that page. */
export function homeSeeAllLabel(hasJobs: boolean, total: number | null | undefined): string {
  if (!hasJobs) return "Browse jobs";
  if (typeof total !== "number" || !Number.isFinite(total) || total < 1) return "See all jobs";
  const count = Math.floor(total);
  return count === 1 ? "See all 1 job" : `See all ${count} jobs`;
}

export function boardAccessHeadline(
  tier: BoardTier | null | undefined,
  total: number | null | undefined,
  companies = 0,
) {
  const companyLabel =
    companies > 0 ? ` from ${companies} ${companies === 1 ? "company" : "companies"}` : "";
  if (typeof total !== "number" || !Number.isFinite(total)) return `You're viewing live jobs${companyLabel}`;
  const live = Math.max(0, Math.floor(total));
  const cap = tier ? boardCap(tier) : null;
  if (cap == null || live <= cap) return `You're viewing all ${live} live jobs${companyLabel}`;
  return `You're viewing ${Math.min(cap, live)} of ${live} live jobs${companyLabel}`;
}
