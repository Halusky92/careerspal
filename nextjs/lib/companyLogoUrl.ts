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

export function hostnameFromWebsite(website?: string | null): string | null {
  const raw = (website || "").trim();
  if (!raw || raw === "#" || raw.startsWith("mailto:") || raw.startsWith("/")) return null;
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    if (!host || isAtsHostname(host)) return null;
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

export function publicLogoFallbacks(website?: string | null): string[] {
  const host = hostnameFromWebsite(website);
  if (!host) return [];
  return [googleFaviconUrl(host, 128), duckDuckGoIconUrl(host), `https://${host}/favicon.ico`];
}
