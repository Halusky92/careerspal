/** Public logo URLs derived from a company website (no Clearbit). */

export function isAtsHostname(hostname: string): boolean {
  const h = hostname.replace(/^www\./i, "").toLowerCase();
  return (
    h.endsWith("greenhouse.io") ||
    h.endsWith("lever.co") ||
    h.endsWith("ashbyhq.com") ||
    h.endsWith("myworkdayjobs.com") ||
    h.endsWith("workable.com")
  );
}

const DIRECTORY_HOSTS = [
  "linkedin.com",
  "g2.com",
  "crunchbase.com",
  "wikipedia.org",
  "glassdoor.com",
  "indeed.com",
  "wellfound.com",
  "builtin.com",
  "zoominfo.com",
  "owler.com",
  "pitchbook.com",
  "yelp.com",
  "trustpilot.com",
  "facebook.com",
  "instagram.com",
  "x.com",
  "twitter.com",
  "youtube.com",
];

/** A directory, social profile, or ATS host is not the company's own site. */
export function isNotCompanyWebsiteHost(hostname: string): boolean {
  const host = hostname.replace(/^www\./i, "").toLowerCase();
  if (!host || isAtsHostname(host)) return true;
  return DIRECTORY_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

export function hostnameFromWebsite(website?: string | null): string | null {
  const raw = (website || "").trim();
  if (!raw || raw === "#" || raw.startsWith("mailto:") || raw.startsWith("/")) return null;
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    if (!host || isNotCompanyWebsiteHost(host)) return null;
    return host;
  } catch {
    return null;
  }
}

export function googleFaviconUrl(host: string, size = 128): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size}`;
}

export function duckDuckGoIconUrl(host: string): string {
  return `https://icons.duckduckgo.com/ip3/${host}.ico`;
}

export function publicLogoUrlForWebsite(website?: string | null): string | null {
  const host = hostnameFromWebsite(website);
  if (!host) return null;
  return googleFaviconUrl(host);
}

/** A favicon or image that points at G2, LinkedIn, or another directory is not the company logo. */
export function isDirectoryLogo(url?: string | null): boolean {
  const raw = (url || "").trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const domain = parsed.searchParams.get("domain") || "";
    if (domain && isNotCompanyWebsiteHost(domain)) return true;
    const host = parsed.hostname.replace(/^www\./i, "");
    if (host === "google.com" || host.endsWith(".google.com") || host.endsWith("duckduckgo.com")) return false;
    return isNotCompanyWebsiteHost(host);
  } catch {
    return false;
  }
}

export function officialWebsiteUrl(website?: string | null): string | null {
  const host = hostnameFromWebsite(website);
  if (!host) return null;
  return `https://${host}`;
}

export function isSocialPreviewImage(url?: string | null): boolean {
  const value = (url || "").toLowerCase();
  return (
    value.includes("custom-agents-og") ||
    /(?:^|[/_.-])(?:og|opengraph|twitter|social)[-_](?:image|card)/.test(value) ||
    /\/og\.(png|jpe?g|webp)(?:$|\?)/.test(value)
  );
}

export function chooseDisplayedLogo(candidates: Array<string | null | undefined>, website?: string | null): string | null {
  for (const item of candidates) {
    const value = (item || "").trim();
    if (!value || isSocialPreviewImage(value)) continue;
    return value;
  }
  return publicLogoUrlForWebsite(website);
}

export function publicLogoFallbacks(website?: string | null): string[] {
  const host = hostnameFromWebsite(website);
  if (!host) return [];
  return [googleFaviconUrl(host, 128), duckDuckGoIconUrl(host), `https://${host}/favicon.ico`];
}
