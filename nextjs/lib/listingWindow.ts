import type { BoardTier } from "./boardAccess";

/** Premium sees a role as soon as it is published. Everyone else, including Google, waits this long. */
export const EARLY_ACCESS_MS = 24 * 60 * 60 * 1000;

/** After it is public, a new role stays at the top of Most relevant for the rest of this window. */
export const PRIORITY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** The New mark covers the premium day and the next two public days. */
export const NEW_BADGE_MS = 3 * 24 * 60 * 60 * 1000;

type Stamp = {
  timestamp?: number | null;
  publishedAt?: string | null;
  createdAt?: string | null;
  published_at?: string | null;
  created_at?: string | null;
};

function instantMs(value?: string | number | null): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === "string" && value.trim()) {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

/** When the role landed on CareersPal. The source's original post date is only a fallback. */
export function listedAtMs(job: Stamp): number | null {
  return (
    instantMs(job.publishedAt) ??
    instantMs(job.published_at) ??
    instantMs(job.createdAt) ??
    instantMs(job.created_at) ??
    instantMs(job.timestamp)
  );
}

export function isEarlyAccessListing(job: Stamp, now = Date.now()): boolean {
  const seen = listedAtMs(job);
  if (seen == null) return false;
  return now - seen < EARLY_ACCESS_MS;
}

export function isPriorityListing(job: Stamp, now = Date.now()): boolean {
  const seen = listedAtMs(job);
  if (seen == null) return false;
  return now - seen < PRIORITY_WINDOW_MS;
}

export function isNewListing(job: Stamp, now = Date.now()): boolean {
  const seen = listedAtMs(job);
  if (seen == null) return false;
  return now - seen < NEW_BADGE_MS;
}

export function viewerCanSeeListing(job: Stamp, tier: BoardTier | null | undefined, now = Date.now()): boolean {
  if (!isEarlyAccessListing(job, now)) return true;
  return tier === "paid";
}

export function listingsForViewer<T extends Stamp>(jobs: T[], tier: BoardTier | null | undefined, now = Date.now()): T[] {
  return jobs.filter((job) => viewerCanSeeListing(job, tier, now));
}
