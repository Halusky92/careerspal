import { inferWorkMode } from "../../workMode";
import { usMarketEligibility } from "../discovery/usMarket";

type DiscoveryJob = {
  title?: string | null;
  location_text?: string | null;
  remote_policy?: string | null;
  description_clean?: string | null;
};

/** US-remote gate for sources saved by Discovery. Existing boards are unchanged. */
export function discoveryMarketBlockers(job: DiscoveryJob): string[] {
  const mode = inferWorkMode({
    title: job.title,
    remotePolicy: job.remote_policy,
    location: job.location_text,
    description: job.description_clean,
  });
  const reasons: string[] = [];
  if (mode === "Onsite") reasons.push("onsite_only");
  else if (mode === "Hybrid") reasons.push("hybrid_not_remote");
  else if (mode !== "Remote") reasons.push("remote_unconfirmed");
  const geo = usMarketEligibility(job.location_text, job.remote_policy, job.description_clean);
  if (geo !== "us") reasons.push(geo === "outside_us" ? "outside_us" : "geo_unconfirmed");
  return reasons;
}

export function discoverySourceKey(sourceType: string | null | undefined, identifier: string | null | undefined) {
  const type = (sourceType || "").trim().toLowerCase();
  const id = (identifier || "").trim().toLowerCase();
  if (!type || !id) return "";
  return `${type}:${id}`;
}
