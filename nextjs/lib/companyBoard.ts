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
  return (
    t.includes("greenhouse is more than a hiring platform") ||
    t.includes("complete hiring ecosystem") ||
    t.includes("coming soon")
  );
};

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
