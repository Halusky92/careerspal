import type { SupabaseClient } from "@supabase/supabase-js";
import { Job } from "../types";
import { applyLiveBoardFilter, isLiveBoardJob } from "./liveBoard";
import { isOnNicheJob } from "./nicheScope";
import { getCategoryHub, jobMatchesHub, resolveCategoryParam } from "./categories";
import { mapSupabaseJob, type SupabaseJobRow } from "./supabaseJobs";
import { boardCap, boardPageForTier, type BoardTier } from "./boardAccess";

export const PUBLIC_JOB_SELECT =
  "id,title,description,location,remote_policy,type,salary,posted_at_text,timestamp,category,apply_url,company_description,company_website,logo_url,tags,tools,benefits,keywords,match_score,is_featured,status,plan_type,plan_price,plan_currency,views,matches,companies(name,slug,logo_url,website,description,verified)";

export type PublicBoardFilters = {
  company?: string | null;
  category?: string | null;
  type?: string | null;
  planType?: string | null;
  remote?: string | null;
};

type AdminSb = SupabaseClient<any, "public", any>;

export async function loadPublishedBoardJobs(sb: AdminSb, filters: PublicBoardFilters = {}): Promise<Job[]> {
  const categoryParam = resolveCategoryParam(filters.category || undefined);
  const categoryHub = categoryParam !== "All Roles" ? getCategoryHub(categoryParam) : null;
  const pageSize = 200;
  const jobs: Job[] = [];
  for (let offset = 0; offset < 2000; offset += pageSize) {
    let query = sb.from("jobs").select(PUBLIC_JOB_SELECT).eq("status", "published").order("timestamp", { ascending: false });
    query = applyLiveBoardFilter(query);
    if (filters.type) query = query.eq("type", filters.type);
    if (filters.planType) query = query.eq("plan_type", filters.planType);
    if (filters.remote) query = query.ilike("remote_policy", `%${filters.remote}%`);
    if (filters.company) query = query.ilike("companies.name", `%${filters.company}%`);
    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = (data as unknown as SupabaseJobRow[] | null) || [];
    jobs.push(
      ...rows
        .map(mapSupabaseJob)
        .filter((job) => isOnNicheJob(job) && (!categoryHub || jobMatchesHub(job, categoryHub))),
    );
    if (rows.length < pageSize) break;
  }
  return jobs;
}

export function pagePublishedBoard(jobs: Job[], tier: BoardTier, opts: { skip?: number; limit?: number }) {
  return boardPageForTier(jobs, tier, opts);
}

const LIVE_COUNT_PAGE = 200;
const LIVE_COUNT_MAX_ROWS = 20000;

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

/** Same published + live + niche rules as the public board. Null when the count cannot be finished. */
export async function countLivePublishedJobs(
  sb: AdminSb,
  filters: PublicBoardFilters = {},
): Promise<number | null> {
  const categoryParam = resolveCategoryParam(filters.category || undefined);
  const categoryHub = categoryParam !== "All Roles" ? getCategoryHub(categoryParam) : null;
  const pages: Array<{ fetched: number; counted: number }> = [];
  const now = Date.now();
  try {
    for (let offset = 0; offset < LIVE_COUNT_MAX_ROWS; offset += LIVE_COUNT_PAGE) {
      let query = sb
        .from("jobs")
        .select("status,title,category,description,timestamp,published_at,created_at,companies(name)")
        .eq("status", "published")
        .order("timestamp", { ascending: false });
      query = applyLiveBoardFilter(query);
      if (filters.type) query = query.eq("type", filters.type);
      if (filters.planType) query = query.eq("plan_type", filters.planType);
      if (filters.remote) query = query.ilike("remote_policy", `%${filters.remote}%`);
      if (filters.company) query = query.ilike("companies.name", `%${filters.company}%`);
      const { data, error } = await query.range(offset, offset + LIVE_COUNT_PAGE - 1);
      if (error) return null;
      const rows = (data as LiveCountRow[] | null) || [];
      const counted = rows.filter(
        (row) => isCountedLiveJob(row, now) && (!categoryHub || jobMatchesHub(row, categoryHub)),
      ).length;
      pages.push({ fetched: rows.length, counted });
      if (rows.length < LIVE_COUNT_PAGE) return totalFromCountPages(pages, LIVE_COUNT_PAGE);
    }
    return null;
  } catch {
    return null;
  }
}

export function cappedListTake(tier: BoardTier, requested: number) {
  const cap = boardCap(tier);
  if (cap == null) return requested;
  return Math.min(requested, cap);
}
