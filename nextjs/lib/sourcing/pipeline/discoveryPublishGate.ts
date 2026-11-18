import { inferWorkMode } from "../../workMode";
import { usMarketEligibility } from "../discovery/usMarket";

type DiscoveryJob = {
  title?: string | null;
  location_text?: string | null;
  remote_policy?: string | null;
  description_clean?: string | null;
};

function remoteConflictsWithPosting(description: string) {
  return /\bhybrid work model\b|\bapproach to hybrid\b|\bhybrid working\b|\bin-office expectations\b/i.test(description);
}

/** Auto-publish floor. Below this, a USD role is not the salary-first board. */
export const MIN_USD_ANNUAL_PAY = 60_000;

export function annualizedUsdPay(
  min: number | null | undefined,
  max: number | null | undefined,
  period: string | null | undefined,
  currency: string | null | undefined,
): number | null {
  if ((currency || "").trim().toUpperCase() !== "USD") return null;
  const lo = typeof min === "number" ? min : typeof max === "number" ? max : null;
  const hi = typeof max === "number" ? max : typeof min === "number" ? min : null;
  if (lo == null || hi == null) return null;
  const mid = (lo + hi) / 2;
  const unit = (period || "").toLowerCase();
  if (unit.includes("hour")) return mid * 2080;
  if (unit.includes("day")) return mid * 260;
  if (unit.includes("month")) return mid * 12;
  if (unit.includes("year") || unit.includes("annual")) return mid;
  return null;
}

export function payBelowBoard(job: {
  salary_amount_min?: number | null;
  salary_amount_max?: number | null;
  salary_period?: string | null;
  salary_currency?: string | null;
}): boolean {
  const annual = annualizedUsdPay(job.salary_amount_min, job.salary_amount_max, job.salary_period, job.salary_currency);
  return annual != null && annual < MIN_USD_ANNUAL_PAY;
}

function geoRestrictionMissingFromLocation(location: string, description: string) {
  if (!/not eligible to be hired in\s+\S/i.test(description)) return false;
  return !/not eligible/i.test(location);
}

/** Shared gate for Greenhouse, Ashby, Lever, and Discovery, including a later reopen. */
export function discoveryMarketBlockers(job: DiscoveryJob): string[] {
  const description = job.description_clean || "";
  const location = job.location_text || "";
  const mode = inferWorkMode({
    title: job.title,
    remotePolicy: job.remote_policy,
    location: job.location_text,
    description,
  });
  const reasons: string[] = [];
  if (mode === "Onsite") reasons.push("onsite_only");
  else if (mode !== "Remote" && mode !== "Hybrid") reasons.push("remote_unconfirmed");
  if (mode === "Remote" && remoteConflictsWithPosting(description)) reasons.push("work_mode_conflict");
  if (mode === "Hybrid") {
    const geo = usMarketEligibility(job.location_text, job.remote_policy, job.description_clean);
    if (geo !== "us") reasons.push(geo === "outside_us" ? "outside_us" : "geo_unconfirmed");
  }
  if ((mode === "Remote" || mode === "Hybrid") && geoRestrictionMissingFromLocation(location, description)) {
    reasons.push("geo_restriction");
  }
  return reasons;
}

export function discoverySourceKey(sourceType: string | null | undefined, identifier: string | null | undefined) {
  const type = (sourceType || "").trim().toLowerCase();
  const id = (identifier || "").trim().toLowerCase();
  if (!type || !id) return "";
  return `${type}:${id}`;
}
