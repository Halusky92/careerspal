import { stripHtmlToText } from "./text";
import { detectAndParseSalaryForGreenhouse, parsedSalaryFromStructured, type ParsedSalary } from "./salary";
import type { LeverJob } from "../connectors/lever";
import type { NormalizedCandidate } from "./greenhouse";

export function normalizeLeverRawPayload(args: {
  sourceUrl: string;
  externalJobId: string;
  companyName?: string | null;
  rawPayload: unknown;
}): Omit<NormalizedCandidate, "source_type"> & { source_type: "lever" } {
  const job = (args.rawPayload || {}) as LeverJob;
  const html = (job.description || job.descriptionBody || "").trim() || null;
  const plain = (job.descriptionPlain || "").trim() || (html ? stripHtmlToText(html) : null);
  const location = (job.categories?.location || "").trim() || null;
  const workplace = (job.workplaceType || "").toLowerCase();
  const remote =
    workplace.includes("remote") || (location || "").toLowerCase().includes("remote")
      ? "Remote"
      : workplace.includes("hybrid")
        ? "Hybrid"
        : workplace.includes("onsite") || workplace.includes("office")
          ? "Onsite"
          : null;
  let salary: ParsedSalary = parsedSalaryFromStructured({
    min: job.salaryRange?.min ?? null,
    max: job.salaryRange?.max ?? null,
    currency: job.salaryRange?.currency || null,
    period: job.salaryRange?.interval || null,
    rawText: job.salaryRange
      ? `${job.salaryRange.currency || ""} ${job.salaryRange.min ?? ""}-${job.salaryRange.max ?? ""} ${job.salaryRange.interval || ""}`
      : null,
  });
  if (!salary.salary_present && plain) {
    const fromText = detectAndParseSalaryForGreenhouse(plain);
    if (fromText.salary_present) salary = fromText;
  }
  const postedAt = typeof job.createdAt === "number" ? new Date(job.createdAt).toISOString() : null;

  return {
    source_type: "lever",
    source_url: args.sourceUrl,
    external_job_id: args.externalJobId,
    job_url: (job.hostedUrl || job.applyUrl || null) as string | null,
    apply_url: (job.applyUrl || job.hostedUrl || null) as string | null,
    title: (job.text || null) as string | null,
    company_name: args.companyName || null,
    location_text: location,
    remote_policy: remote,
    posted_at: postedAt,
    description_raw: html,
    description_clean: plain,
    ...salary,
    provenance: {
      team_text: [job.categories?.department, job.categories?.team].filter(Boolean).join(" / ") || null,
      salary: salary.salary_detected_from,
    },
  };
}
