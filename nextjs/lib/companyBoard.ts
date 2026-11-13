import { resolveCategoryHub, type CategorySlug } from "./categories";
import { jobMatchesLocationQuery } from "./locationFilter";

export type BoardCompany = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string;
  website: string;
  description: string;
  location: string;
  verified: boolean;
  liveRoles: number;
  hubs: CategorySlug[];
  remote: boolean;
  locationsBlob: string;
  remotePolicyBlob: string;
};

export const plainCompanyText = (value: string) =>
  value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const isBoilerplateDescription = (value?: string | null) => {
  const t = (value || "").toLowerCase();
  if (!t.trim()) return false;
  return (
    t.includes("greenhouse is more than a hiring platform") ||
    t.includes("greenhouse is the talent operating system") ||
    t.includes("complete hiring ecosystem") ||
    t.includes("hiring platform that helps companies") ||
    t.includes("structured hiring") && t.includes("greenhouse") ||
    t.includes("applicant tracking") && t.includes("greenhouse") ||
    t.includes("talent operating system") ||
    /\bgreenhouse software\b/.test(t) ||
    /\bgreenhouse\.io\b/.test(t) ||
    t.includes("coming soon") ||
    isStorefrontPromo(t)
  );
};

/** A retail homepage blurb, whatever the brand is. */
export function isStorefrontPromo(value?: string | null) {
  const text = (value || "").toLowerCase();
  const shop = /\b(?:shop|visit|welcome to|join)\s+(?:www\.)?[a-z0-9-]+\.(?:com|co|io|ai|org)\b/.test(text);
  const promo = /\b(free shipping|free delivery|low prices|start your free|no order minimum)\b/.test(text);
  return shop && promo;
}

const PROMO_BRAND = /\b(?:shop|visit|welcome to|join)\s+(?:www\.)?([a-z0-9-]+)\.(?:com|co|io|ai|org)\b/i;

function brandKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function siteHost(pageUrl?: string | null) {
  try {
    return new URL(pageUrl || "").hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function hostKey(pageUrl?: string | null) {
  return siteHost(pageUrl).split(".")[0] || "";
}

/** A homepage blurb that sells a different company's storefront. */
export function isForeignCompanyBlurb(description?: string | null, companyName?: string | null, pageUrl?: string | null) {
  const brand = brandKey((description || "").match(PROMO_BRAND)?.[1] || "");
  if (!brand) return false;
  const name = brandKey(companyName || "");
  const host = brandKey(hostKey(pageUrl));
  if (name && (name.includes(brand) || brand.includes(name))) return false;
  if (host && (host === brand || host.includes(brand) || brand.includes(host))) return false;
  return true;
}

/** The fetched page landed on a different site than the company URL. */
export function landedOnAnotherHost(requestedUrl?: string | null, landedUrl?: string | null) {
  const requested = siteHost(requestedUrl);
  const landed = siteHost(landedUrl);
  if (!requested || !landed) return false;
  return requested !== landed && !requested.endsWith(`.${landed}`) && !landed.endsWith(`.${requested}`);
}

/** "Shop walmart.com" copied from a different site than the one we fetched. */
export function blurbConflictsWithHost(description?: string | null, pageUrl?: string | null) {
  return isForeignCompanyBlurb(description, "", pageUrl) || isStorefrontPromo(description);
}

export const publicCompanyHost = (value?: string | null) => {
  const host = companyHost(value);
  if (!host) return "";
  if (host.includes("greenhouse.io") || host.includes("lever.co") || host.includes("ashbyhq.com")) return "";
  return host;
};

export const companyHost = (value?: string | null) => {
  const raw = (value || "").trim();
  if (!raw || raw === "#") return "";
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return raw.replace(/^https?:\/\//, "").replace(/^www\./, "");
  }
};

export function companyMatchesLocation(company: BoardCompany, query: string): boolean {
  return jobMatchesLocationQuery(
    { location: `${company.location || ""} ${company.locationsBlob || ""}`, remotePolicy: company.remotePolicyBlob || "" },
    query,
  );
}

export function addJobToCompany(
  current: BoardCompany | undefined,
  input: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string | null;
    website?: string | null;
    description?: string | null;
    location?: string | null;
    verified?: boolean | null;
    jobTitle?: string | null;
    jobCategory?: string | null;
    jobLocation?: string | null;
    jobRemotePolicy?: string | null;
  },
): BoardCompany {
  const hub = resolveCategoryHub({ title: input.jobTitle, category: input.jobCategory });
  const remote = /\bremote\b/i.test(`${input.jobRemotePolicy || ""} ${input.jobLocation || ""}`);
  if (current) {
    current.liveRoles += 1;
    if (hub && !current.hubs.includes(hub.slug)) current.hubs.push(hub.slug);
    if (remote) current.remote = true;
    current.locationsBlob = `${current.locationsBlob} ${input.jobLocation || ""}`.trim();
    current.remotePolicyBlob = `${current.remotePolicyBlob} ${input.jobRemotePolicy || ""}`.trim();
    return current;
  }
  const desc = isBoilerplateDescription(input.description) ? "" : plainCompanyText(input.description || "");
  return {
    id: input.id,
    name: input.name,
    slug: input.slug,
    logoUrl: input.logoUrl || "",
    website: input.website || "",
    description: desc,
    location: (input.location || "").trim(),
    verified: Boolean(input.verified),
    liveRoles: 1,
    hubs: hub ? [hub.slug] : [],
    remote,
    locationsBlob: (input.jobLocation || "").trim(),
    remotePolicyBlob: (input.jobRemotePolicy || "").trim(),
  };
}
