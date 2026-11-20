import { hostnameDomain } from "./workEmailDomain";

export type CompanyMatchKind = "domain" | "alias" | "ats" | "name";

export type CompanyMatchCandidate = {
  id: string;
  name: string;
  website?: string | null;
  domains?: string[];
  aliases?: string[];
  atsIdentifiers?: string[];
};

export type CompanyMatchInput = {
  name?: string | null;
  website?: string | null;
  atsIdentifier?: string | null;
};

export type CompanyMatch =
  | { status: "none" }
  | { status: "match"; companyId: string; name: string; kind: CompanyMatchKind }
  | { status: "ambiguous"; companyIds: string[]; reason: string };

const GENERIC_HOSTS = new Set([
  "greenhouse.io",
  "boards.greenhouse.io",
  "job-boards.greenhouse.io",
  "ashbyhq.com",
  "jobs.ashbyhq.com",
  "lever.co",
  "jobs.lever.co",
]);

/** Trailing legal words only. A shorter name must not swallow a longer one. */
export function companyIdentityKey(name?: string | null) {
  const raw = (name || "").toLowerCase().replace(/&/g, " and ");
  const letters = raw.replace(/[^a-z0-9]+/g, "");
  const stripped = raw
    .replace(/\b(incorporated|corporation|limited|company|corp|gmbh|llc|ltd|inc|co)\b\.?/g, " ")
    .replace(/[^a-z0-9]+/g, "");
  return stripped.length >= 3 ? stripped : letters;
}

function usableHost(value?: string | null) {
  const host = hostnameDomain(value);
  if (!host || !host.includes(".")) return "";
  if (GENERIC_HOSTS.has(host)) return "";
  if ([...GENERIC_HOSTS].some((generic) => host === generic || host.endsWith(`.${generic}`))) return "";
  return host;
}

function hostsOf(candidate: CompanyMatchCandidate) {
  const hosts = [usableHost(candidate.website), ...(candidate.domains || []).map((domain) => usableHost(domain))];
  return new Set(hosts.filter(Boolean));
}

export function classifyCompanyMatch(input: CompanyMatchInput, candidates: CompanyMatchCandidate[]): CompanyMatch {
  const nameKey = companyIdentityKey(input.name);
  const host = usableHost(input.website);
  const ats = (input.atsIdentifier || "").trim().toLowerCase();
  const keys = new Map<string, string[]>();
  for (const candidate of candidates) {
    const key = companyIdentityKey(candidate.name);
    if (!key) continue;
    keys.set(key, [...(keys.get(key) || []), candidate.id]);
  }

  const hits = new Map<string, { id: string; name: string; kinds: CompanyMatchKind[] }>();
  const add = (candidate: CompanyMatchCandidate, kind: CompanyMatchKind) => {
    const current = hits.get(candidate.id) || { id: candidate.id, name: candidate.name, kinds: [] };
    if (!current.kinds.includes(kind)) current.kinds.push(kind);
    hits.set(candidate.id, current);
  };

  for (const candidate of candidates) {
    if (host && hostsOf(candidate).has(host)) add(candidate, "domain");
    if (ats && (candidate.atsIdentifiers || []).some((value) => value.trim().toLowerCase() === ats)) add(candidate, "ats");
    if (nameKey && (candidate.aliases || []).some((alias) => companyIdentityKey(alias) === nameKey)) add(candidate, "alias");
    const candidateKey = companyIdentityKey(candidate.name);
    if (nameKey && candidateKey === nameKey) {
      if ((keys.get(nameKey) || []).length > 1) continue;
      add(candidate, "name");
    }
  }

  if (nameKey && (keys.get(nameKey) || []).length > 1) {
    return { status: "ambiguous", companyIds: keys.get(nameKey) || [], reason: "same_normalized_name" };
  }
  if (hits.size > 1) {
    return { status: "ambiguous", companyIds: [...hits.keys()], reason: "signals_disagree" };
  }
  const only = [...hits.values()][0];
  if (!only) return { status: "none" };
  const kind = only.kinds.includes("domain")
    ? "domain"
    : only.kinds.includes("ats")
      ? "ats"
      : only.kinds.includes("alias")
        ? "alias"
        : "name";
  return { status: "match", companyId: only.id, name: only.name, kind };
}
