import type { SupabaseClient } from "@supabase/supabase-js";
import { Job } from "../types";
import { isLiveBoardJob } from "./liveBoard";
import { isOnNicheJob } from "./nicheScope";
import { getCategoryHub, jobMatchesHub, resolveCategoryParam } from "./categories";
import { publicLocationLabel } from "./workMode";
import { boardCap, boardPageForTier, type BoardTier } from "./boardAccess";
import { getBoardCatalog } from "./publicBoardCatalog";

export const PUBLIC_JOB_SELECT =
  "id,title,description,location,remote_policy,type,salary,posted_at_text,timestamp,published_at,created_at,category,apply_url,company_description,company_website,logo_url,tags,tools,benefits,keywords,match_score,is_featured,status,plan_type,plan_price,plan_currency,views,matches,companies(name,slug,logo_url,website,description,verified)";

export type PublicBoardFilters = {
  company?: string | null;
  category?: string | null;
  type?: string | null;
  planType?: string | null;
  remote?: string | null;
};

type AdminSb = SupabaseClient<any, "public", any>;

/** The list uses the same place as the detail. A bare Remote stays until a country is confirmed. */
export function withPublicLocation(job: Job): Job {
  const raw = (job.location || "").trim();
  if (raw && !/^(remote|hybrid)$/i.test(raw)) return job;
  const shown = publicLocationLabel(job);
  if (!shown || shown === raw) return job;
  return { ...job, location: shown };
}

export function applyStoredBoardFilters(jobs: Job[], filters: PublicBoardFilters = {}): Job[] {
  const categoryParam = resolveCategoryParam(filters.category || undefined);
  const categoryHub = categoryParam !== "All Roles" ? getCategoryHub(categoryParam) : null;
  const company = (filters.company || "").trim().toLowerCase();
  const type = (filters.type || "").trim();
  const planType = (filters.planType || "").trim();
  const remote = (filters.remote || "").trim().toLowerCase();
  return jobs.filter((job) => {
    if (categoryHub && !jobMatchesHub(job, categoryHub)) return false;
    if (type && job.type !== type) return false;
    if (planType && (job.planType || "") !== planType) return false;
    if (remote && !(job.remotePolicy || "").toLowerCase().includes(remote)) return false;
    if (company && !(job.company || "").toLowerCase().includes(company)) return false;
    return true;
  });
}

/** The shared slim index. `sb` is accepted so older callers keep their signature. */
export async function loadPublishedBoardJobs(_sb: AdminSb, filters: PublicBoardFilters = {}): Promise<Job[]> {
  const jobs = await getBoardCatalog();
  return applyStoredBoardFilters(jobs, filters);
}

export function pagePublishedBoard(jobs: Job[], tier: BoardTier, opts: { skip?: number; limit?: number }) {
  return boardPageForTier(jobs, tier, opts);
}

export type LiveCountRow = {
  status?: string | null;
  title?: string | null;
  category?: string | null;
  description?: string | null;
  timestamp?: number | null;
  published_at?: string | null;
  created_at?: string | null;
  publishedAt?: string | null;
  createdAt?: string | null;
};

/** Published, inside the live window, and on niche. Draft, paused, rejected, and pending review are out. */
export function isCountedLiveJob(row: LiveCountRow, now = Date.now()): boolean {
  if (row.status !== "published") return false;
  if (!isLiveBoardJob(row, now)) return false;
  return isOnNicheJob({
    title: row.title || "",
    category: row.category || "",
    description: row.description || "",
  });
}

export function countLivePublishedRows(rows: LiveCountRow[], now = Date.now()): number {
  return rows.reduce((sum, row) => sum + (isCountedLiveJob(row, now) ? 1 : 0), 0);
}

/**
 * Sum pages from the live-board query. A full final page means the read stopped early,
 * so the total is unknown instead of a truncated number.
 */
export function totalFromCountPages(
  pages: Array<{ fetched: number; counted: number }>,
  pageSize: number,
): number | null {
  if (!Number.isFinite(pageSize) || pageSize < 1) return null;
  let total = 0;
  for (const page of pages) {
    if (page.fetched < 0 || page.counted < 0 || page.counted > page.fetched) return null;
    total += page.counted;
    if (page.fetched < pageSize) return total;
  }
  return pages.length === 0 ? 0 : null;
}

/** Same published + live + niche rules as the public board. Null when the index cannot be read. */
export async function countLivePublishedJobs(
  _sb: AdminSb,
  filters: PublicBoardFilters = {},
): Promise<number | null> {
  try {
    const jobs = await getBoardCatalog();
    return applyStoredBoardFilters(jobs, filters).length;
  } catch {
    return null;
  }
}

export function cappedListTake(tier: BoardTier, requested: number) {
  const cap = boardCap(tier);
  if (cap == null) return requested;
  return Math.min(requested, cap);
}
