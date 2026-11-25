import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Job } from "../types";
import { addJobToCompany, type BoardCompany } from "./companyBoard";
import { createCompanySlug } from "./jobs";
import { applyLiveBoardFilter, isLiveBoardJob } from "./liveBoard";
import { isOnNicheJob } from "./nicheScope";
import { supabaseAdmin } from "./supabaseAdmin";
import { mapSupabaseJob, type SupabaseJobRow } from "./supabaseJobs";
import { BOARD_INDEX_REVALIDATE_SECONDS, toBoardCard } from "./boardListQuery";

type AdminSb = SupabaseClient<any, "public", any>;

const INDEX_PAGE = 200;
const INDEX_MAX_ROWS = 20000;

/** Card columns. The posting body is read once while the index is built, then dropped. */
export const BOARD_CARD_SELECT =
  "id,title,location,remote_policy,type,salary,posted_at_text,timestamp,published_at,created_at,updated_at,category,apply_url,company_website,logo_url,tags,tools,keywords,match_score,is_featured,status,plan_type,plan_price,plan_currency,origin,company_id,companies(name,slug,logo_url,website,description,verified,location)";

const companyOf = (row: SupabaseJobRow & { companies?: { location?: string | null } | null }) => {
  const rel = row.companies as { location?: string | null } | { location?: string | null }[] | null | undefined;
  return Array.isArray(rel) ? rel[0] : rel;
};

async function descriptionsFor(sb: AdminSb, ids: string[]) {
  const found = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { data, error } = await sb.from("jobs").select("id,description").in("id", chunk);
    if (error) return found;
    for (const row of data || []) {
      if (row?.id) found.set(String(row.id), String(row.description || ""));
    }
  }
  return found;
}

/** Pages the live published table, keeps niche rows, and stores cards without descriptions. */
export async function loadBoardIndex(sb: AdminSb): Promise<Job[]> {
  const rows: Array<SupabaseJobRow & { updated_at?: string | null; company_id?: string | null }> = [];
  for (let offset = 0; offset < INDEX_MAX_ROWS; offset += INDEX_PAGE) {
    const { data, error } = await applyLiveBoardFilter(
      sb.from("jobs").select(BOARD_CARD_SELECT).eq("status", "published").order("timestamp", { ascending: false }),
    ).range(offset, offset + INDEX_PAGE - 1);
    if (error) throw new Error(error.message);
    const page = (data as unknown as typeof rows | null) || [];
    rows.push(...page);
    if (page.length < INDEX_PAGE) break;
  }
  const descriptions = await descriptionsFor(
    sb,
    rows.map((row) => row.id),
  );
  const cards: Job[] = [];
  for (const row of rows) {
    if (!isLiveBoardJob(row)) continue;
    const company = companyOf(row);
    const mapped = mapSupabaseJob({ ...row, description: descriptions.get(row.id) || "" });
    if (!isOnNicheJob(mapped)) continue;
    const card = toBoardCard(mapped);
    card.updatedAt = row.updated_at || undefined;
    card.companyLocation = company?.location || undefined;
    card.companyId = card.companyId || row.company_id || undefined;
    cards.push(card);
  }
  return cards;
}

const readCachedBoardIndex = unstable_cache(
  async () => {
    if (!supabaseAdmin) return [] as Job[];
    return loadBoardIndex(supabaseAdmin);
  },
  ["public-board-index-v1"],
  { revalidate: BOARD_INDEX_REVALIDATE_SECONDS },
);

/** Shared public index. Early-access rows stay in it; each request removes them for non-Premium viewers. */
export function getBoardCatalog() {
  return readCachedBoardIndex();
}

export function companiesFromBoard(jobs: Job[]): BoardCompany[] {
  const map = new Map<string, BoardCompany>();
  for (const job of jobs) {
    const name = (job.company || "").trim();
    if (!name) continue;
    const slug = ((job.companySlug || "").trim() || createCompanySlug({ name })).trim();
    const id = (job.companyId || slug || name).trim();
    if (!id || !slug) continue;
    const next = addJobToCompany(map.get(id), {
      id,
      name,
      slug,
      logoUrl: job.logo || null,
      website: job.companyWebsite || null,
      description: job.companyDescription || null,
      location: job.companyLocation || null,
      verified: job.companyVerified ?? null,
      jobTitle: job.title,
      jobCategory: job.category,
      jobLocation: job.location,
      jobRemotePolicy: job.remotePolicy,
    });
    map.set(id, next);
  }
  return [...map.values()].sort((a, b) => b.liveRoles - a.liveRoles || a.name.localeCompare(b.name));
}
