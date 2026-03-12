const COMPOUND_SUFFIXES = new Set<string>([
  // UK
  "co.uk",
  "org.uk",
  "ac.uk",
  "gov.uk",
  // AU
  "com.au",
  "net.au",
  "org.au",
  // NZ
  "co.nz",
  // BR / MX / JP / KR / SG (common corporate patterns)
  "com.br",
  "com.mx",
  "co.jp",
  "co.kr",
  "com.sg",
]);

export function normalizeHost(host: string): string {
  return (host || "")
    .trim()
    .toLowerCase()
    .replace(/^www\./, "")
    .replace(/:\d+$/, "");
}

// Minimal, explainable registrable-domain heuristic.
// Prefer a proper PSL library later; this is an MVP-safe fallback.
export function getRegistrableDomain(host: string): string {
  const h = normalizeHost(host);
  if (!h) return "";
  const parts = h.split(".").filter(Boolean);
  if (parts.length <= 2) return h;

  const last2 = parts.slice(-2).join(".");
  if (COMPOUND_SUFFIXES.has(last2)) {
    // e.g. careers.example.co.uk → registrable = example.co.uk
    return parts.slice(-3).join(".");
  }

  // Default: eTLD+1 = last two labels
  return parts.slice(-2).join(".");
}

export function normalizeUrlForRegistry(input: string): {
  normalizedUrl: string;
  host: string;
  registrableDomain: string;
} {
  const raw = (input || "").trim();
  const url = new URL(raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`);

  // Strip common tracking params.
  const toDelete = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
    "fbclid",
  ];
  toDelete.forEach((k) => url.searchParams.delete(k));

  // Normalize trailing slash (but keep path).
  url.hash = "";
  const host = normalizeHost(url.host);
  const registrableDomain = getRegistrableDomain(host);

  // Rebuild with normalized host casing.
  url.host = host;
  // Trim trailing slashes for stability (except root).
  if (url.pathname !== "/" && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }
  const normalizedUrl = url.toString();

  return { normalizedUrl, host, registrableDomain };
}

