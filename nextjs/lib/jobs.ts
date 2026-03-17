import { Company, Job } from "../types";

const slugify = (value: string) =>
  (value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

export const createJobSlug = (job: Pick<Job, "title" | "id">) =>
  `${slugify(job.title || "role")}--${job.id}`;

export const getJobIdFromSlug = (slug: unknown): string | null => {
  if (typeof slug !== "string") return null;
  const trimmed = slug.trim();
  if (!trimmed) return null;
  const parts = trimmed.split("--").filter(Boolean);
  if (parts.length === 0) return null;
  return parts.length > 1 ? parts[parts.length - 1] : trimmed;
};

export const createCompanySlug = (company: Pick<Company, "name">) =>
  `${slugify(company.name || "company")}`;
