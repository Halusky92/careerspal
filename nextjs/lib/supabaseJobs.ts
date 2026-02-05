import { Job, PlanType } from "../types";

export type SupabaseCompanyRow = {
  name?: string | null;
  logo_url?: string | null;
  website?: string | null;
  description?: string | null;
} | null;

export type SupabaseJobRow = {
  id: string;
  title: string | null;
  description: string | null;
  location: string | null;
  remote_policy: string | null;
  type: string | null;
  salary: string | null;
  posted_at_text: string | null;
  timestamp: number | null;
  category: string | null;
  apply_url: string | null;
  company_description: string | null;
  company_website: string | null;
  logo_url: string | null;
  tags: unknown;
  tools: unknown;
  benefits: unknown;
  keywords: string | null;
  match_score: number | null;
  is_featured: boolean | null;
  status: string | null;
  plan_type: string | null;
  plan_price: number | null;
  plan_currency: string | null;
  views: number | null;
  matches: number | null;
  companies?: SupabaseCompanyRow;
};

export const mapSupabaseJob = (row: SupabaseJobRow): Job => ({
  id: row.id,
  title: row.title || "",
  company: row.companies?.name || "Unknown",
  logo: row.logo_url || row.companies?.logo_url || "",
  location: row.location || "Remote",
  type: (row.type as Job["type"]) || "Full-time",
  salary: row.salary || "",
  postedAt: row.posted_at_text || "Just now",
  category: row.category || "Operations",
  description: row.description || "",
  tags: (row.tags as string[]) || [],
  tools: (row.tools as string[]) || [],
  isFeatured: Boolean(row.is_featured),
  planType: (row.plan_type || undefined) as Job["planType"],
  plan: row.plan_price
    ? { type: (row.plan_type || "Standard") as PlanType, price: row.plan_price }
    : undefined,
  remotePolicy: row.remote_policy || "Remote",
  applyUrl: row.apply_url || "#",
  companyDescription: row.company_description || row.companies?.description || undefined,
  benefits: (row.benefits as string[]) || [],
  matchScore: row.match_score || undefined,
  timestamp: row.timestamp || undefined,
  status: row.status || "draft",
  views: row.views || 0,
  matches: row.matches || 0,
  companyWebsite: row.company_website || row.companies?.website || undefined,
  keywords: row.keywords || undefined,
});
