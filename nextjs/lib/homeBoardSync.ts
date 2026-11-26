import { tierForPublicList, type BoardTier } from "./boardAccess";
import { isEarlyAccessListing } from "./listingWindow";

export type HomeProfile = {
  role?: string | null;
  premiumUntil?: string | null;
  subscriptionStatus?: string | null;
};

export type HomeSync = {
  tier: BoardTier | null;
  request: number;
};

export function homeViewerTier(accessToken: string | null | undefined, profile: HomeProfile | null): BoardTier {
  return tierForPublicList({
    signedIn: Boolean(accessToken),
    role: profile?.role,
    premiumUntil: profile?.premiumUntil,
    subscriptionStatus: profile?.subscriptionStatus,
  });
}

export function jobsForHomeViewer<T extends Parameters<typeof isEarlyAccessListing>[0]>(
  jobs: T[],
  tier: BoardTier,
  now = Date.now(),
): T[] {
  if (tier === "paid") return jobs;
  return jobs.filter((job) => !isEarlyAccessListing(job, now));
}

/** The first settled session reuses the server list. A later tier change fetches once. */
export function nextHomeSync(sync: HomeSync, tier: BoardTier, initialAccess: BoardTier): { sync: HomeSync; fetch: boolean } {
  if (sync.tier === tier) return { sync, fetch: false };
  if (sync.tier === null && tier === initialAccess) {
    return { sync: { tier, request: sync.request }, fetch: false };
  }
  return { sync: { tier, request: sync.request + 1 }, fetch: true };
}

/** A response applies only to the latest request for the tier that is on screen now. */
export function acceptHomeResponse(sync: HomeSync, request: number, requestedTier: BoardTier): boolean {
  return sync.request === request && sync.tier === requestedTier;
}
