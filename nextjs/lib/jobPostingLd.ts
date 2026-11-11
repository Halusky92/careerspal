import { parseSalaryFromText, type SalaryPeriod } from "./sourcing/normalization/salary";
import { inferWorkMode } from "./workMode";
import { isLiveBoardJob } from "./liveBoard";
import { applyUrlLooksUsable } from "./jobs/applyLinkHealth";
import type { Job } from "../types";

const PERIOD_UNIT: Record<SalaryPeriod, string> = {
  year: "YEAR",
  month: "MONTH",
  day: "DAY",
  hour: "HOUR",
};

export function googleEmploymentType(type?: string | null): string {
  switch (type) {
    case "Full-time":
      return "FULL_TIME";
    case "Part-time":
      return "PART_TIME";
    case "Contract":
    case "Freelance":
      return "CONTRACTOR";
    case "Temporary":
      return "TEMPORARY";
    case "Internship":
      return "INTERN";
    default:
      return "OTHER";
  }
}

export function countryFromLocation(text?: string | null): string | undefined {
  const t = (text || "").toLowerCase();
  if (!t) return undefined;
  if (/\bunited states\b|\bu\.s\.a\.?\b|\busa\b/.test(t)) return "US";
  if (/\bremote\s*[-–,]\s*us\b/.test(t) || /\bus-remote\b/.test(t)) return "US";
  if (/\bcanada\b/.test(t)) return "CA";
  if (/\bunited kingdom\b|\bu\.k\.?\b|\bengland\b/.test(t)) return "GB";
  return undefined;
}

function postedDate(job: Job): Date | null {
  const ts = job.timestamp;
  if (typeof ts === "number" && Number.isFinite(ts) && ts > 0) {
    const ms = ts < 1e12 ? ts * 1000 : ts;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function isHttpApply(url?: string | null) {
  const value = (url || "").trim();
  if (!applyUrlLooksUsable(value)) return false;
  if (value.startsWith("mailto:") || (value.includes("@") && !value.includes("://"))) return false;
  return value.startsWith("http://") || value.startsWith("https://") || !value.startsWith("/");
}

export function shouldEmitJobPosting(job: Job): boolean {
  if (job.status && job.status !== "published") return false;
  if (!isLiveBoardJob({ timestamp: job.timestamp })) return false;
  if (!job.title?.trim() || !job.company?.trim()) return false;
  return isHttpApply(job.applyUrl);
}

export function buildJobPostingLd(job: Job, canonicalUrl: string) {
  if (!shouldEmitJobPosting(job)) return null;

  const posted = postedDate(job);
  const datePosted = posted ? posted.toISOString() : undefined;
  // Only emit validThrough when the employer/ATS provided an end date.
  // Do not invent posted+30d — that is a board hygiene window, not a real expiry.

  const parsed = parseSalaryFromText(job.salary || "");
  const period = parsed.salary_period;
  const min = parsed.salary_amount_min;
  const max = parsed.salary_amount_max;
  const currency = (parsed.salary_currency || "").toUpperCase();
  const oteFloor =
    max == null && /\b(ote|on-target earnings|on target earnings)\b/i.test(`${job.salary || ""}\n${job.description || ""}`);
  const baseSalary =
    !oteFloor && parsed.salary_present && currency && period && (min != null || max != null)
      ? {
          "@type": "MonetaryAmount",
          currency,
          value: {
            "@type": "QuantitativeValue",
            ...(min != null ? { minValue: min } : {}),
            ...(max != null ? { maxValue: max } : {}),
            unitText: PERIOD_UNIT[period],
          },
        }
      : undefined;

  const workMode = inferWorkMode(job);
  const loc = (job.location || "").trim();
  const remote = workMode === "Remote" || /^remote\b/i.test(loc);
  const country = countryFromLocation(`${loc} ${job.remotePolicy || ""}`);

  const logo = (job.logo || "").trim();
  const website = (job.companyWebsite || "").trim();
  const atsHost = /greenhouse\.io|lever\.co|ashbyhq\.com/i.test(website);

  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: (job.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 8000),
    datePosted,
    employmentType: googleEmploymentType(job.type),
    url: canonicalUrl,
    identifier: {
      "@type": "PropertyValue",
      name: "CareersPal",
      value: job.id,
    },
    hiringOrganization: {
      "@type": "Organization",
      name: job.company,
      sameAs: website && !atsHost ? website : undefined,
      logo: logo || undefined,
    },
    directApply: true,
  };

  if (baseSalary) ld.baseSalary = baseSalary;

  if (remote) {
    ld.jobLocationType = "TELECOMMUTE";
    if (country) {
      ld.applicantLocationRequirements = { "@type": "Country", name: country };
    }
  }
  if (loc) {
    ld.jobLocation = {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: loc,
        addressCountry: country,
      },
    };
  }

  return ld;
}
