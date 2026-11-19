import { chooseOfficialSalary, parseSalaryFromText, type ParsedSalary, type SalaryPeriod } from "./sourcing/normalization/salary";
import { salaryPlaceHint } from "./formatSalary";
import { geographyLabel, inferWorkMode } from "./workMode";
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

const OTHER_CURRENCY = /\b(?:CAD|AUD|EUR|GBP|NZD|CHF|SGD|HKD|INR|JPY|SEK|NOK|DKK|PLN|CZK)\b|CA\$|A\$|€|£/i;

function placeConfirmsUsd(job: Job) {
  return applicantCountries(job).length === 1 && applicantCountries(job)[0] === "US";
}

/** A bare $ is not a named currency. USD is used only when the posting or the place says the United States. */
function salaryForGoogle(job: Job, parsed: ParsedSalary | null): ParsedSalary | null {
  if (!parsed?.salary_currency) return null;
  if (parsed.salary_currency !== "USD") return parsed;
  const named = /\bUSD\b|US\$/i.test(`${job.salary || ""}\n${job.description || ""}`);
  if (named || placeConfirmsUsd(job)) return parsed;
  return null;
}

function structuredSalary(job: Job): ParsedSalary | null {
  const description = job.description || "";
  const official = chooseOfficialSalary(description, salaryPlaceHint(job));
  if (official.salary_present && official.salary_currency && (official.salary_amount_min != null || official.salary_amount_max != null)) {
    return salaryForGoogle(job, official);
  }
  const stored = parseSalaryFromText(job.salary || "");
  const oteFloor =
    stored.salary_amount_max == null &&
    /\b(ote|on-target earnings|on target earnings)\b/i.test(`${job.salary || ""}\n${description}`);
  if (oteFloor) return null;
  const conflicting = official.salary_parse_notes.includes("multiple_salary_bands");
  const storedNamesCurrency = OTHER_CURRENCY.test(job.salary || "") || /\bUSD\b|US\$/i.test(job.salary || "");
  if (conflicting || (OTHER_CURRENCY.test(description) && !storedNamesCurrency)) return null;
  const storedHasRange =
    stored.salary_amount_min != null &&
    stored.salary_amount_max != null &&
    stored.salary_amount_min !== stored.salary_amount_max;
  if (!storedHasRange) {
    const fromPosting = parseSalaryFromText(description);
    const postingHasRange =
      fromPosting.salary_present &&
      fromPosting.salary_currency &&
      fromPosting.salary_period &&
      fromPosting.salary_amount_min != null &&
      fromPosting.salary_amount_max != null &&
      fromPosting.salary_amount_min !== fromPosting.salary_amount_max;
    const sameFloor = stored.salary_amount_min == null || stored.salary_amount_min === fromPosting.salary_amount_min;
    if (postingHasRange && sameFloor) return salaryForGoogle(job, fromPosting);
  }
  if (!stored.salary_present || !stored.salary_currency) return null;
  return salaryForGoogle(job, stored);
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

const COUNTRY_ONLY = new Set([
  "United States",
  "Canada",
  "United Kingdom",
  "International",
  "Worldwide",
  "Global",
  "US",
  "USA",
  "Not specified",
]);

/** Google's JobPosting examples use these country names, not ISO codes. */
function applicantCountryName(code: string) {
  if (code === "US") return "USA";
  if (code === "CA") return "Canada";
  if (code === "GB") return "United Kingdom";
  return code;
}

function isCountryOnlyLabel(value: string) {
  return COUNTRY_ONLY.has(value.trim());
}

/** Keep paragraph breaks. Google requires them and ignores a single collapsed line. */
function jobPostingDescription(value: string) {
  const text = value
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|ul|ol)>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<[^>]+>/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (text.length <= 12000) return text;
  const cut = text.slice(0, 12000);
  const lastBreak = cut.lastIndexOf("\n");
  return (lastBreak > 8000 ? cut.slice(0, lastBreak) : cut).trim();
}

export function shouldEmitJobPosting(job: Job): boolean {
  if (job.status && job.status !== "published") return false;
  if (!isLiveBoardJob(job)) return false;
  if (!postedDate(job)) return false;
  if (!job.title?.trim() || !job.company?.trim()) return false;
  if (!jobPostingDescription(job.description || "")) return false;
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
  const place = geographyLabel(job);
  const specificPlace = place && !isCountryOnlyLabel(place) ? place : "";
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
    description: jobPostingDescription(job.description || ""),
    datePosted,
    ...(googleEmploymentType(job.type) !== "OTHER" ? { employmentType: googleEmploymentType(job.type) } : {}),
    url: canonicalUrl,
    identifier: {
      "@type": "PropertyValue",
      name: job.company,
      value: job.id,
    },
    hiringOrganization: {
      "@type": "Organization",
      name: job.company,
      sameAs: website && !atsHost ? website : undefined,
      logo: logo || undefined,
    },
  };

  if (baseSalary) ld.baseSalary = baseSalary;

  if (remote) {
    ld.jobLocationType = "TELECOMMUTE";
    if (countries.length === 1) {
      ld.applicantLocationRequirements = { "@type": "Country", name: applicantCountryName(countries[0]) };
    } else if (countries.length > 1) {
      ld.applicantLocationRequirements = countries.map((name) => ({ "@type": "Country", name: applicantCountryName(name) }));
    }
  }
  if (workMode === "Hybrid" && specificPlace) {
    const parts = specificPlace.split(/\s+or\s+/i).map((part) => part.trim()).filter((part) => part.length > 1);
    const placeFor = (locality: string) => ({
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: locality,
        addressCountry: country,
      },
    });
    ld.jobLocation = parts.length > 1 ? parts.map(placeFor) : placeFor(specificPlace);
  } else if (specificPlace) {
    ld.jobLocation = {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: specificPlace,
        addressCountry: country,
      },
    };
  } else if (loc && !isCountryOnlyLabel(loc) && !/^(remote|hybrid)(\b|[\s•·-])/i.test(loc)) {
    ld.jobLocation = {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: loc,
        addressCountry: country,
      },
    };
  } else if (!remote && country) {
    ld.jobLocation = {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressCountry: country,
      },
    };
  }

  if (remote && !ld.applicantLocationRequirements) delete ld.jobLocationType;
  if (!ld.jobLocation && !ld.applicantLocationRequirements) return null;

  return ld;
}
