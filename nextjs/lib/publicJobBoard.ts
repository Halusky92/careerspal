import type { SupabaseClient } from "@supabase/supabase-js";
import { Job } from "../types";
import { applyLiveBoardFilter } from "./liveBoard";
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

export function cappedListTake(tier: BoardTier, requested: number) {
  const cap = boardCap(tier);
  if (cap == null) return requested;
  return Math.min(requested, cap);
}
