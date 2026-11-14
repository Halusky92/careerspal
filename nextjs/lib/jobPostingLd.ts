import { chooseOfficialSalary, parseSalaryFromText, type ParsedSalary, type SalaryPeriod } from "./sourcing/normalization/salary";
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
  return countriesInLocation(text)[0];
}

function countriesInLocation(text?: string | null): string[] {
  const t = (text || "").toLowerCase();
  if (!t) return [];
  const found: string[] = [];
  if (
    /\bunited states\b|\bu\.s\.a\.?\b|\busa\b/.test(t) ||
    /\bremote\s*[-–,(]\s*us\b/.test(t) ||
    /\bremote\s+in\s+the\s+us\b/.test(t) ||
    /\bremote\s+us\b/.test(t) ||
    /\bus\s*[-–]?\s*remote\b/.test(t) ||
    /\bus-remote\b/.test(t) ||
    /\(\s*us\s*\)/.test(t)
  ) {
    found.push("US");
  }
  if (/\bcanada\b/.test(t)) found.push("CA");
  if (/\bunited kingdom\b|\bu\.k\.?\b|\bengland\b/.test(t)) found.push("GB");
  return found;
}

function countriesInDescription(text?: string | null): string[] {
  const t = text || "";
  const found: string[] = [];
  if (
    /\b(?:within|anywhere in|based in|located in|authorized to work in|eligible to work in)\s+the\s+united states\b/i.test(t) ||
    /\bremote\s+(?:within|in|across)\s+the\s+united states\b/i.test(t) ||
    /\b(?:united states|u\.s\.|usa)\s+only\b/i.test(t)
  ) {
    found.push("US");
  }
  if (
    /\b(?:within|anywhere in|based in|located in|authorized to work in|eligible to work in)\s+canada\b/i.test(t) ||
    /\bremote\s+(?:within|in|across)\s+canada\b/i.test(t) ||
    /\bcanada\s+only\b/i.test(t)
  ) {
    found.push("CA");
  }
  if (
    /\b(?:within|anywhere in|based in|located in|authorized to work in|eligible to work in)\s+the\s+united kingdom\b/i.test(t) ||
    /\b(?:uk|u\.k\.|united kingdom)\s+only\b/i.test(t)
  ) {
    found.push("GB");
  }
  return found;
}

/** Countries an applicant must be in. Location wins. The description counts only for an explicit restriction. */
export function applicantCountries(job: { location?: string | null; remotePolicy?: string | null; description?: string | null }): string[] {
  const fromLocation = countriesInLocation(`${job.location || ""} ${job.remotePolicy || ""}`);
  if (fromLocation.length) return fromLocation;
  return countriesInDescription(job.description);
}

const OTHER_CURRENCY = /\b(?:CAD|AUD|EUR|GBP|NZD|CHF)\b|CA\$|A\$|€|£/i;

function structuredSalary(job: Job): ParsedSalary | null {
  const description = job.description || "";
  const official = chooseOfficialSalary(description, `${job.location || ""} ${job.remotePolicy || ""}`);
  if (official.salary_present && official.salary_currency && (official.salary_amount_min != null || official.salary_amount_max != null)) {
    return official;
  }
  const stored = parseSalaryFromText(job.salary || "");
  const oteFloor =
    stored.salary_amount_max == null &&
    /\b(ote|on-target earnings|on target earnings)\b/i.test(`${job.salary || ""}\n${description}`);
  if (oteFloor || !stored.salary_present || !stored.salary_currency) return null;
  const conflicting = official.salary_parse_notes.includes("multiple_salary_bands");
  const storedNamesCurrency = OTHER_CURRENCY.test(job.salary || "") || /\bUSD\b|US\$/i.test(job.salary || "");
  if (conflicting || (OTHER_CURRENCY.test(description) && !storedNamesCurrency)) return null;
  return stored;
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
  if (!isLiveBoardJob(job)) return false;
  if (!job.title?.trim() || !job.company?.trim()) return false;
  return isHttpApply(job.applyUrl);
}

export function buildJobPostingLd(job: Job, canonicalUrl: string) {
  if (!shouldEmitJobPosting(job)) return null;

  const posted = postedDate(job);
  const datePosted = posted ? posted.toISOString() : undefined;
  // Only emit validThrough when the employer/ATS provided an end date.
  // Do not invent posted+30d — that is a board hygiene window, not a real expiry.

  const parsed = structuredSalary(job);
  const period = parsed?.salary_period;
  const min = parsed?.salary_amount_min;
  const max = parsed?.salary_amount_max;
  const currency = (parsed?.salary_currency || "").toUpperCase();
  const baseSalary =
    parsed && currency && period && (min != null || max != null)
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
  const countries = applicantCountries(job);
  const locationCountry = countriesInLocation(`${loc} ${job.remotePolicy || ""}`);
  const country = locationCountry.length === 1 ? locationCountry[0] : undefined;

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
    if (countries.length === 1) {
      ld.applicantLocationRequirements = { "@type": "Country", name: countries[0] };
    } else if (countries.length > 1) {
      ld.applicantLocationRequirements = countries.map((name) => ({ "@type": "Country", name }));
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
