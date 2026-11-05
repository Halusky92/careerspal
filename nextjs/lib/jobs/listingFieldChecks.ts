import { applyUrlLooksUsable } from "./applyLinkHealth";
import { scoreCandidate } from "../sourcing/evaluation/scoring";
import { REASON_SEVERITY, type ReasonCode } from "../sourcing/evaluation/reasonCodes";

export type ScreenIssue = { field: string; message: string };

export const REQUIRED_FIELDS = ["title", "salary", "description", "applyUrl"] as const;
export type RequiredField = (typeof REQUIRED_FIELDS)[number];
export const DESCRIPTION_MAX = 4000;

export const isWorkingApply = (raw?: string | null) => applyUrlLooksUsable(raw);

export const hasSalary = (raw?: string | null) => {
  const value = (raw || "").trim();
  if (!value) return false;
  if (/^(tbd|n\/a|negotiable|competitive|-)$/i.test(value)) return false;
  return /\d/.test(value);
};

const REASON_COPY: Record<string, ScreenIssue> = {
  OFF_NICHE: {
    field: "title",
    message: "Use an Ops / Systems title, e.g. Operations Manager.",
  },
  CAT_LOW_CONF: {
    field: "description",
    message: "Name the Ops/Systems work in the first lines (workflows, tools, process).",
  },
  SALARY_MISSING: { field: "salary", message: "Add a USD range, e.g. $90k–$120k." },
  APPLY_MISSING: { field: "applyUrl", message: "Add an apply link (a careers page URL is enough)." },
  DESCRIPTION_THIN: {
    field: "description",
    message: "Add responsibilities and requirements (about 280+ characters).",
  },
  METADATA_WEAK: { field: "description", message: "Add company, apply link, and a fuller description." },
};

const EMPLOYER_IGNORE = new Set([
  "SOURCE_WEAK",
  "ONSITE_ONLY",
  "REMOTE_UNCLEAR",
  "METADATA_WEAK",
  "DESCRIPTION_THIN",
  "CAT_LOW_CONF",
  "OFF_NICHE",
]);

export type ListingFields = {
  title?: string | null;
  description?: string | null;
  salary?: string | null;
  applyUrl?: string | null;
  apply_url?: string | null;
  company?: string | null;
  location?: string | null;
  remotePolicy?: string | null;
  remote_policy?: string | null;
  category?: string | null;
};

export const applyFrom = (job: ListingFields) => job.applyUrl || job.apply_url || "";
export const remoteFrom = (job: ListingFields) => job.remotePolicy || job.remote_policy || "";

export function listingFingerprint(job: ListingFields) {
  return [
    String(job.title || "").trim(),
    String(job.description || "").trim(),
    String(job.salary || "").trim(),
    String(applyFrom(job)).trim(),
    String(job.company || "").trim(),
  ].join("\u001f");
}

export function localListingIssues(job: ListingFields): ScreenIssue[] {
  const title = String(job.title || "").trim();
  const description = String(job.description || "").trim();
  const issues: ScreenIssue[] = [];

  if (title.length < 4) {
    issues.push({ field: "title", message: "Enter a job title (4+ characters)." });
  }
  if (!hasSalary(job.salary)) issues.push(REASON_COPY.SALARY_MISSING);
  if (!isWorkingApply(applyFrom(job))) issues.push(REASON_COPY.APPLY_MISSING);
  if (!description) {
    issues.push({ field: "description", message: "Add a description of the role." });
  } else if (description.length > DESCRIPTION_MAX) {
    issues.push({ field: "description", message: `Keep the description under ${DESCRIPTION_MAX} characters.` });
  }

  const scored = scoreCandidate({
    title,
    company_name: job.company || null,
    apply_url: applyFrom(job) || null,
    job_url: applyFrom(job) || null,
    location_text: job.location || null,
    remote_policy: remoteFrom(job) || null,
    description_clean: description,
    salary_present: hasSalary(job.salary),
    source_type: "direct_custom",
  });

  scored.reasons.forEach((code) => {
    if (EMPLOYER_IGNORE.has(code)) return;
    const copy = REASON_COPY[code];
    if (copy && !issues.some((item) => item.message === copy.message)) issues.push(copy);
  });

  const unique = issues.filter(
    (item, index) => issues.findIndex((other) => other.field === item.field && other.message === item.message) === index,
  );
  return unique;
}

export function localFieldOk(job: ListingFields, field: RequiredField) {
  return !localListingIssues(job).some((issue) => issue.field === field);
}

export function localBlockingReasons(job: ListingFields) {
  const title = String(job.title || "").trim();
  const description = String(job.description || "").trim();
  const scored = scoreCandidate({
    title,
    company_name: job.company || null,
    apply_url: applyFrom(job) || null,
    job_url: applyFrom(job) || null,
    location_text: job.location || null,
    remote_policy: remoteFrom(job) || null,
    description_clean: description,
    salary_present: hasSalary(job.salary),
    source_type: "direct_custom",
  });
  return scored.reasons.filter((code) => {
    if (EMPLOYER_IGNORE.has(code)) return false;
    return (
      REASON_SEVERITY[code as ReasonCode] === "BLOCK" ||
      code === "DESCRIPTION_THIN" ||
      code === "CAT_LOW_CONF" ||
      code === "METADATA_WEAK"
    );
  });
}
