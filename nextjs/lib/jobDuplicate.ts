import { companyIdentityKey } from "./companyMatch";
import { isSourcedJobOrigin } from "./sourcing/origin";

export type ExistingJobIdentity = {
  id: string;
  applyUrl?: string | null;
  title?: string | null;
  location?: string | null;
  companyId?: string | null;
  atsId?: string | null;
};

const TRACKING_PARAM = /^(utm_.*|gh_src|lever-source|lever_source|source|ref|referral)$/i;

export function canonicalApplyUrl(value?: string | null) {
  const raw = (value || "").trim();
  if (!raw || raw === "#") return "";
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    const path = url.pathname.replace(/\/+$/, "");
    const params = [...url.searchParams.entries()]
      .filter(([key]) => !TRACKING_PARAM.test(key))
      .sort(([left], right) => left.localeCompare(right[0]));
    const query = params.map(([key, item]) => `${key}=${item}`).join("&");
    return `${host}${path}${query ? `?${query}` : ""}`.toLowerCase();
  } catch {
    return raw.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
  }
}

export function applyUrlAtsId(value?: string | null) {
  const raw = (value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return (url.searchParams.get("gh_jid") || url.searchParams.get("ashby_jid") || "").trim().toLowerCase();
  } catch {
    return "";
  }
}

function placeKey(value?: string | null) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export type DuplicateDecision =
  | { action: "create" }
  | { action: "block"; jobId: string; reason: "apply_url" | "ats_id" }
  | { action: "review"; jobId: string; reason: "title_location" };

export function classifyJobDuplicate(
  input: { applyUrl?: string | null; title?: string | null; location?: string | null; companyId?: string | null; atsId?: string | null },
  existing: ExistingJobIdentity[],
): DuplicateDecision {
  const apply = canonicalApplyUrl(input.applyUrl);
  const ats = (input.atsId || applyUrlAtsId(input.applyUrl) || "").trim().toLowerCase();
  const title = companyIdentityKey(input.title);
  const place = placeKey(input.location);
  for (const job of existing) {
    if (apply && canonicalApplyUrl(job.applyUrl) === apply) return { action: "block", jobId: job.id, reason: "apply_url" };
    const jobAts = (job.atsId || applyUrlAtsId(job.applyUrl) || "").trim().toLowerCase();
    if (ats && jobAts === ats) return { action: "block", jobId: job.id, reason: "ats_id" };
  }
  for (const job of existing) {
    if (!input.companyId || job.companyId !== input.companyId) continue;
    if (!title || companyIdentityKey(job.title) !== title) continue;
    if (placeKey(job.location) !== place) continue;
    return { action: "review", jobId: job.id, reason: "title_location" };
  }
  return { action: "create" };
}

/** Nightly sourcing may refresh its own unpaid cards. Paid and employer-owned rows stay put. */
export function sourcingMayOverwrite(job: {
  origin?: string | null;
  planPrice?: number | null;
  stripePaymentStatus?: string | null;
}) {
  if (job.origin === "employer") return false;
  if (typeof job.planPrice === "number" && job.planPrice > 0) return false;
  if (job.planPrice === 0) return false;
  if (job.stripePaymentStatus === "paid" || job.stripePaymentStatus === "founding") return false;
  if (job.origin && !isSourcedJobOrigin(job.origin) && job.origin !== "sourced") return false;
  return true;
}
