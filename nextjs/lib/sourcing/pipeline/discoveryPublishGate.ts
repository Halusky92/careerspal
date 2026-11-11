import { inferWorkMode } from "../../workMode";
import { usMarketEligibility } from "../discovery/usMarket";

type DiscoveryJob = {
  title?: string | null;
  location_text?: string | null;
  remote_policy?: string | null;
  description_clean?: string | null;
};

/** Shared gate for Greenhouse, Ashby, Lever, and Discovery, including a later reopen. */
export function discoveryMarketBlockers(job: DiscoveryJob): string[] {
  const mode = inferWorkMode({
    title: job.title,
    remotePolicy: job.remote_policy,
    location: job.location_text,
    description: job.description_clean,
  });
  const reasons: string[] = [];
  if (mode === "Onsite") reasons.push("onsite_only");
  else if (mode !== "Remote" && mode !== "Hybrid") reasons.push("remote_unconfirmed");
  if (mode === "Hybrid") {
    const geo = usMarketEligibility(job.location_text, job.remote_policy, job.description_clean);
    if (geo !== "us") reasons.push(geo === "outside_us" ? "outside_us" : "geo_unconfirmed");
  }
  return reasons;
}

export function discoverySourceKey(sourceType: string | null | undefined, identifier: string | null | undefined) {
  const type = (sourceType || "").trim().toLowerCase();
  const id = (identifier || "").trim().toLowerCase();
  if (!type || !id) return "";
  return `${type}:${id}`;
}
