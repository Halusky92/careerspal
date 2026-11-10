export const CANONICAL_ORIGIN = "https://www.careerspal.com";

function isLocalHost(host: string) {
  return host === "localhost" || host === "127.0.0.1";
}

/** Public/canonical origin: www in production, never a Vercel preview host. */
export function canonicalizePublicOrigin(raw: string | null | undefined): string {
  const value = (raw || "").trim().replace(/\/+$/, "");
  if (!value) return CANONICAL_ORIGIN;
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    const host = url.hostname.toLowerCase();
    if (isLocalHost(host)) {
      return `${url.protocol}//${url.host}`.replace(/\/+$/, "");
    }
    if (host === "www.careerspal.com" || host === "careerspal.com" || host.endsWith(".vercel.app")) {
      return CANONICAL_ORIGIN;
    }
    return `${url.protocol}//${url.host}`.replace(/\/+$/, "");
  } catch {
    return CANONICAL_ORIGIN;
  }
}

export function getPublicSiteUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) return canonicalizePublicOrigin(siteUrl);
  if (process.env.VERCEL_ENV === "production" || process.env.VERCEL_URL) {
    return CANONICAL_ORIGIN;
  }
  return "http://localhost:3000";
}

export const getCanonicalSiteUrl = getPublicSiteUrl;
