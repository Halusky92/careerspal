// Default denylist seed for third-party job boards / reposts / aggregators.
// Keep this compact and maintainable. Prefer blocking obvious repost sources aggressively.

export const DENYLIST_EXACT_HOSTS = new Set<string>([
  // Major job boards / social job boards
  "linkedin.com",
  "indeed.com",
  "glassdoor.com",
  "monster.com",
  "ziprecruiter.com",
  "careerbuilder.com",

  // Remote / curated third-party boards (still repost sources)
  "remoteok.com",
  "weworkremotely.com",
  "remotive.com",
  "himalayas.app",
  "flexjobs.com",
  "wellfound.com",
  "builtin.com",

  // Aggregators / meta search
  "jooble.org",
  "talent.com",
  "simplyhired.com",
  "jobrapido.com",

  // Marketplaces (not official hiring sources)
  "upwork.com",
  "freelancer.com",
  "fiverr.com",
  "toptal.com",

  // Social / forums (not official careers sources)
  "reddit.com",
  "facebook.com",
  "x.com",
  "twitter.com",

  // Job distribution / repost infra
  "appcast.io",
  "jobcase.com",
]);

// Pattern-based denylist for multi-TLD properties.
// Pattern matches if host endsWith(pattern) or equals pattern (for ".*" we keep it simple).
export const DENYLIST_SUFFIXES = [
  "adzuna.com",
  "adzuna.co.uk",
  "adzuna.de",
  "adzuna.fr",
  "adzuna.nl",
  "adzuna.pl",
  "adzuna.es",
  "adzuna.it",
  "adzuna.ca",
  "adzuna.com.au",
];

export function matchDenylistHost(host: string): { matched: boolean; matchDomain?: string } {
  const h = (host || "").trim().toLowerCase().replace(/^www\./, "");
  if (!h) return { matched: false };

  if (DENYLIST_EXACT_HOSTS.has(h)) return { matched: true, matchDomain: h };

  // If the host is a subdomain of an exact deny host, still deny.
  for (const exact of DENYLIST_EXACT_HOSTS) {
    if (h === exact) return { matched: true, matchDomain: exact };
    if (h.endsWith(`.${exact}`)) return { matched: true, matchDomain: exact };
  }

  for (const suffix of DENYLIST_SUFFIXES) {
    if (h === suffix || h.endsWith(`.${suffix}`)) return { matched: true, matchDomain: suffix };
  }

  return { matched: false };
}

