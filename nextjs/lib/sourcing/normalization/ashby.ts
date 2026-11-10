import { inferWorkMode } from "../../workMode";
import { stripHtmlToText } from "./text";
import {
  detectAndParseSalaryForGreenhouse,
  parsedSalaryFromStructured,
  type ParsedSalary,
} from "./salary";
import type { AshbyJob } from "../connectors/ashby";
import type { NormalizedCandidate } from "./greenhouse";

function firstSalaryComponent(job: AshbyJob) {
  const tiers = job.compensation?.compensationTiers || [];
  for (const tier of tiers) {
    for (const component of tier.components || []) {
      const type = (component.compensationType || "").toLowerCase();
      if (!type || type.includes("salary") || type.includes("base")) return component;
    }
  }
  return tiers[0]?.components?.[0] || null;
}

export function normalizeAshbyRawPayload(args: {
  sourceUrl: string;
  externalJobId: string;
  companyName?: string | null;
  rawPayload: unknown;
}): Omit<NormalizedCandidate, "source_type"> & { source_type: "ashby" } {
  const job = (args.rawPayload || {}) as AshbyJob;
  const html = (job.descriptionHtml || "").trim() || null;
  const plain = (job.descriptionPlain || "").trim() || (html ? stripHtmlToText(html) : null);
  const location = (job.locationName || "").trim() || null;
  const remote =
    inferWorkMode({
      title: job.title,
      remotePolicy: job.isRemote || (location || "").toLowerCase().includes("remote") ? "Remote" : null,
      location,
      description: plain,
    }) || null;
  const component = firstSalaryComponent(job);
  const summary = job.compensation?.compensationTierSummary || job.compensation?.scrapeableCompensationSalarySummary || null;
  let salary: ParsedSalary = parsedSalaryFromStructured({
    min: component?.minValue ?? null,
    max: component?.maxValue ?? null,
    currency: component?.currencyCode || null,
    period: component?.interval || summary,
    rawText: summary,
  });
  if (!salary.salary_present && plain) {
    const fromText = detectAndParseSalaryForGreenhouse(plain);
    if (fromText.salary_present) salary = fromText;
  }

  return {
    source_type: "ashby",
    source_url: args.sourceUrl,
    external_job_id: args.externalJobId,
    job_url: (job.jobUrl || job.applyUrl || null) as string | null,
    apply_url: (job.applyUrl || job.jobUrl || null) as string | null,
    title: (job.title || null) as string | null,
    company_name: args.companyName || null,
    location_text: location,
    remote_policy: remote,
    posted_at: job.publishedDate || null,
    description_raw: html,
    description_clean: plain,
    ...salary,
    provenance: {
      team_text: [job.departmentName, job.teamName].filter(Boolean).join(" / ") || null,
      salary: salary.salary_detected_from,
    },
  };
}
