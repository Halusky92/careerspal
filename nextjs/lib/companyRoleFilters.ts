import { CATEGORY_HUBS, publicCategoryLabel } from "./categories";
import { placesOnJob } from "./locationFilter";
import { inferWorkMode } from "./workMode";

export const COMPANY_LOCATION_GROUPS = ["United States", "Europe", "Worldwide", "Other locations"] as const;
export type CompanyLocationGroup = (typeof COMPANY_LOCATION_GROUPS)[number];

type CompanyRole = {
  title?: string | null;
  category?: string | null;
  location?: string | null;
  remotePolicy?: string | null;
  description?: string | null;
};

export type CompanyRoleQuery = {
  q: string;
  place: string;
  category: string;
  work: "" | "Remote" | "Hybrid";
};

const EUROPE = new Set(["europe", "uk", "germany", "netherlands", "ireland", "france"]);
const OTHER = new Set(["canada", "australia", "india"]);

/** One place group per role, so the company menu counts add up to the roles on that page. */
export function companyLocationGroup(job: CompanyRole): CompanyLocationGroup {
  const ids = placesOnJob({ location: job.location || "", remotePolicy: job.remotePolicy || "" });
  if (ids.has("us")) return "United States";
  if ([...ids].some((id) => EUROPE.has(id))) return "Europe";
  if ([...ids].some((id) => OTHER.has(id) || id.startsWith("city:"))) return "Other locations";
  return "Worldwide";
}

function matches(job: CompanyRole, filters: CompanyRoleQuery, skip: "place" | "category" | "work" | null) {
  const query = filters.q.trim().toLowerCase();
  if (query && !(job.title || "").toLowerCase().includes(query)) return false;
  if (skip !== "place" && filters.place && companyLocationGroup(job) !== filters.place) return false;
  if (skip !== "category" && filters.category && publicCategoryLabel(job) !== filters.category) return false;
  if (skip !== "work" && filters.work && inferWorkMode(job) !== filters.work) return false;
  return true;
}

export function filterCompanyRoles<T extends CompanyRole>(jobs: T[], filters: CompanyRoleQuery): T[] {
  return jobs.filter((job) => matches(job, filters, null));
}

export type CompanyRoleFacets = {
  total: number;
  categories: { label: string; count: number }[];
  work: { label: "Remote" | "Hybrid"; count: number }[];
  locations: { label: CompanyLocationGroup; count: number }[];
};

/** Counts from the roles this visitor can open at this company. Each group ignores its own selection. */
export function companyRoleFacets(jobs: CompanyRole[], filters: CompanyRoleQuery): CompanyRoleFacets {
  const categoryPool = jobs.filter((job) => matches(job, filters, "category"));
  const workPool = jobs.filter((job) => matches(job, filters, "work"));
  const placePool = jobs.filter((job) => matches(job, filters, "place"));
  const categories = CATEGORY_HUBS.map((hub) => ({
    label: hub.label,
    count: categoryPool.filter((job) => publicCategoryLabel(job) === hub.label).length,
  })).filter((row) => row.count > 0 || row.label === filters.category);
  const work = (["Remote", "Hybrid"] as const)
    .map((label) => ({ label, count: workPool.filter((job) => inferWorkMode(job) === label).length }))
    .filter((row) => row.count > 0 || row.label === filters.work);
  const locations = COMPANY_LOCATION_GROUPS.map((label) => ({
    label,
    count: placePool.filter((job) => companyLocationGroup(job) === label).length,
  })).filter((row) => row.count > 0 || row.label === filters.place);
  return { total: categoryPool.length, categories, work, locations };
}
