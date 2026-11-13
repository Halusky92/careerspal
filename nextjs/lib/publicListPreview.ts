import type { BoardTier } from "./boardAccess";
import { formatJobSalary } from "./formatSalary";
import { createJobSlug } from "./jobs";

export const PUBLIC_COMPANY_JOB_LIMIT = 3;
export const PUBLIC_CATEGORY_JOB_LIMIT = 4;
export const PUBLIC_RELATED_JOB_LIMIT = 3;

const HIDDEN_STATUSES = new Set(["draft", "paused", "rejected", "pending_review"]);

export type PublicJobCard = {
  id: string;
  title: string;
  company: string;
  location: string;
  salaryLabel: string;
  postedAt: string;
  href: string;
};

type ListJob = {
  id: string;
  title?: string | null;
  company?: string | null;
  location?: string | null;
  salary?: string | null;
  description?: string | null;
  postedAt?: string | null;
  timestamp?: number | null;
  status?: string | null;
  applyUrl?: string | null;
};

/** Published rows only. Hidden workflow statuses never enter a public or premium list. */
export function withoutHiddenStatuses<T extends { status?: string | null }>(jobs: T[]): T[] {
  return jobs.filter((job) => {
    const status = (job.status || "").trim();
    if (!status || HIDDEN_STATUSES.has(status)) return false;
    return status === "published";
  });
}

export function rankByNewest<T extends { timestamp?: number | null }>(jobs: T[]): T[] {
  return [...jobs].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
}

/** Newest jobs from this list only. Does not fill the limit from anywhere else. */
export function previewListedJobs<T extends { timestamp?: number | null }>(jobs: T[], limit: number): T[] {
  const take = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 0;
  return rankByNewest(jobs).slice(0, take);
}

export function toPublicJobCard(job: ListJob): PublicJobCard {
  const title = job.title || "role";
  return {
    id: job.id,
    title,
    company: job.company || "",
    location: job.location || "",
    salaryLabel: formatJobSalary({ salary: job.salary, description: job.description }),
    postedAt: job.postedAt || "",
    href: `/jobs/${createJobSlug({ id: job.id, title })}`,
  };
}

export function jobsForViewer<T extends { timestamp?: number | null }>(jobs: T[], tier: BoardTier, limit: number): T[] {
  const ranked = rankByNewest(jobs);
  if (tier === "paid") return ranked;
  return ranked.slice(0, Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 0);
}

export function buildPublicList<T extends ListJob>(jobs: T[], tier: BoardTier, limit: number) {
  const listed = withoutHiddenStatuses(jobs);
  const visible = jobsForViewer(listed, tier, limit);
  return {
    total: listed.length,
    access: tier,
    jobs: visible.map(toPublicJobCard),
  };
}

export function listCacheHeaders(): Record<string, string> {
  return {
    "Cache-Control": "private, no-store",
    "CDN-Cache-Control": "no-store",
    Vary: "Authorization, Cookie",
  };
}

export function publicSuggestItem(item: { id?: unknown; label?: unknown; hint?: unknown } | null | undefined) {
  const label = typeof item?.label === "string" ? item.label.trim().slice(0, 120) : "";
  if (!label) return null;
  return {
    id: typeof item?.id === "string" && item.id.trim() ? item.id.trim().slice(0, 160) : label.toLowerCase(),
    label,
    hint: typeof item?.hint === "string" ? item.hint.trim().slice(0, 40) : "",
  };
}

export function publicSuggestionLabels(values: unknown[], limit: number): string[] {
  const take = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 0;
  const labels: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const label = value.trim().slice(0, 120);
    if (!label || labels.includes(label)) continue;
    labels.push(label);
    if (labels.length >= take) break;
  }
  return labels;
}
