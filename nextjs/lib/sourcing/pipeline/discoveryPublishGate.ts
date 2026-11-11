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
