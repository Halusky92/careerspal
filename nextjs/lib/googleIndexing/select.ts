import { isLiveBoardJob } from "../liveBoard";
import { isEarlyAccessListing, listedAtMs, EARLY_ACCESS_MS } from "../listingWindow";
import { isOnNicheJob } from "../nicheScope";
import type { IndexVisibility } from "./plan";

export const SLIM_JOB_SELECT =
  "id,title,location,remote_policy,type,salary,timestamp,published_at,created_at,updated_at,category,apply_url,status,content_hash,companies(name)";

export type SlimIndexRow = {
  id: string;
  title?: string | null;
  location?: string | null;
  remote_policy?: string | null;
  type?: string | null;
  salary?: string | null;
  timestamp?: number | null;
  published_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  category?: string | null;
  apply_url?: string | null;
  status?: string | null;
  content_hash?: string | null;
  companies?: { name?: string | null } | { name?: string | null }[] | null;
};

export type IndexDigest = {
  jobId: string;
  updatedAt: string;
  contentHash: string;
  descriptionSha: string;
  visibility: IndexVisibility;
  early: boolean;
};

/** Hourly check proposed for roles that just left Premium. Not scheduled. */
export const HOURLY_EARLY_ACCESS_AUTOMATION = false;

export function leftEarlyAccessWindow(row: SlimIndexRow, now: number, withinMs = 60 * 60 * 1000): boolean {
  const seen = listedAtMs({
    timestamp: row.timestamp,
    publishedAt: row.published_at,
    published_at: row.published_at,
    createdAt: row.created_at,
    created_at: row.created_at,
  });
  if (seen == null) return false;
  const age = now - seen;
  return age >= EARLY_ACCESS_MS && age < EARLY_ACCESS_MS + withinMs;
}

function stamp(row: SlimIndexRow) {
  return {
    title: row.title || "",
    category: row.category || "",
    status: row.status || "",
    timestamp: row.timestamp,
    publishedAt: row.published_at,
    published_at: row.published_at,
    createdAt: row.created_at,
    created_at: row.created_at,
  };
}

export function digestIsCurrent(row: SlimIndexRow, digest: IndexDigest | undefined, now: number): boolean {
  if (!digest?.descriptionSha || !digest.visibility) return false;
  if ((digest.updatedAt || "") !== (row.updated_at || "")) return false;
  if ((digest.contentHash || "") !== (row.content_hash || "")) return false;
  const early = isEarlyAccessListing(stamp(row), now);
  if (early !== digest.early) return false;
  return true;
}

/** Descriptions are read only for live public roles whose saved digest is stale. */
export function descriptionIdsForRun(rows: SlimIndexRow[], digests: Map<string, IndexDigest>, now: number, cap: number): string[] {
  const ids: string[] = [];
  const ordered = [...rows].sort((a, b) => (b.published_at || "").localeCompare(a.published_at || ""));
  for (const row of ordered) {
    if (ids.length >= cap) break;
    const job = stamp(row);
    if (row.status !== "published" || !isOnNicheJob(job) || !isLiveBoardJob(job, now) || isEarlyAccessListing(job, now)) continue;
    if (digestIsCurrent(row, digests.get(row.id), now)) continue;
    ids.push(row.id);
  }
  return ids;
}

export function deltaRows(rows: SlimIndexRow[], digests: Map<string, IndexDigest>, now: number): SlimIndexRow[] {
  return rows.filter((row) => {
    const early = isEarlyAccessListing(stamp(row), now);
    const digest = digests.get(row.id);
    if (digest?.early && !early) return true;
    if (leftEarlyAccessWindow(row, now)) return true;
    const updated = Date.parse(row.updated_at || "");
    return Number.isFinite(updated) && now - updated < 60 * 60 * 1000;
  });
}
