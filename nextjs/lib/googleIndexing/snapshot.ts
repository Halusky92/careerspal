import { isLiveBoardJob } from "../liveBoard";
import { isOnNicheJob } from "../nicheScope";
import { shouldEmitJobPosting } from "../jobPostingLd";
import { inferWorkMode } from "../workMode";
import { parseSalaryFromText } from "../sourcing/normalization/salary";
import type { Job } from "../../types";
import { indexVisibility, type IndexJobSnapshot } from "./plan";

export type IndexJobRow = {
  id: string;
  title?: string | null;
  description?: string | null;
  location?: string | null;
  remote_policy?: string | null;
  type?: string | null;
  salary?: string | null;
  timestamp?: number | null;
  published_at?: string | null;
  created_at?: string | null;
  category?: string | null;
  apply_url?: string | null;
  status?: string | null;
  content_hash?: string | null;
  companies?: { name?: string | null } | { name?: string | null }[] | null;
};

export function toIndexSnapshot(row: IndexJobRow): IndexJobSnapshot {
  const rel = row.companies;
  const company = ((Array.isArray(rel) ? rel[0] : rel)?.name || "").trim();
  const salaryText = (row.salary || "").trim();
  const parsed = parseSalaryFromText(salaryText);
  const job = {
    id: row.id,
    title: row.title || "",
    company,
    status: row.status || "",
    applyUrl: row.apply_url || "",
    timestamp: row.timestamp,
    publishedAt: row.published_at,
    published_at: row.published_at,
    createdAt: row.created_at,
    created_at: row.created_at,
    location: row.location,
    remotePolicy: row.remote_policy,
    description: row.description,
    category: row.category,
    type: row.type,
  } as unknown as Job;
  return {
    id: row.id,
    title: row.title || "",
    company,
    location: (row.location || "").trim(),
    workMode: inferWorkMode(job) || (row.remote_policy || "").trim(),
    employmentType: (row.type || "").trim(),
    salaryLabel: salaryText,
    salaryMin: parsed.salary_amount_min,
    salaryMax: parsed.salary_amount_max,
    salaryCurrency: parsed.salary_currency || "",
    salaryPeriod: parsed.salary_period || "",
    applyUrl: (row.apply_url || "").trim(),
    description: row.description || "",
    contentHash: row.content_hash || "",
    visibility: indexVisibility({
      status: row.status,
      onNiche: isOnNicheJob(job),
      live: isLiveBoardJob(job),
      jobPosting: shouldEmitJobPosting(job),
    }),
  };
}
