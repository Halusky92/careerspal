import { blurbConflictsWithHost, isBoilerplateDescription, landedOnAnotherHost } from "./companyBoard";
import { matchDenylistHost } from "./sourcing/denylist";
import { normalizeHost, normalizeUrlForRegistry } from "./sourcing/domain";
import { chooseDisplayedLogo } from "./companyLogoUrl";

export type CompanyWebsiteEnrichment = {
  website: string | null;
  description: string | null;
  logo_url: string | null;
  location?: string | null;
  notes: string[];
};

function extractLinkHref(html: string, relPart: string): string | null {
  const raw = (html || "").toString();
  if (!raw) return null;
  const escaped = relPart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<link[^>]+rel=["'][^"']*${escaped}[^"']*["'][^>]*>`, "i");
  const tag = raw.match(re)?.[0] || "";
  const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
  return (href || "").trim() || null;
}

function extractMeta(html: string, nameOrProp: string): string | null {
  const raw = (html || "").toString();
  if (!raw) return null;
  const escaped = nameOrProp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Match: <meta name="description" content="..."> OR <meta property="og:image" content="...">
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=[\"']${escaped}[\"'][^>]+content=[\"']([^\"']+)[\"'][^>]*>`,
    "i",
  );
  const m = raw.match(re);
  return (m?.[1] || "").trim() || null;
}

function absolutizeUrl(base: string, maybe: string | null): string | null {
  const v = (maybe || "").trim();
  if (!v) return null;
  try {
    return new URL(v, base).toString();
  } catch {
    return null;
  }
}

function extractJsonLdOrganization(html: string): { description?: string | null; logo?: string | null; website?: string | null; location?: string | null } {
  const raw = (html || "").toString();
  if (!raw) return {};
  const scripts = raw.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const s of scripts) {
    const jsonText = s
      .replace(/^[\s\S]*?>/i, "")
      .replace(/<\/script>\s*$/i, "")
      .trim();
    if (!jsonText) continue;
    try {
      const parsed = JSON.parse(jsonText);
      const nodes: any[] = Array.isArray(parsed)
        ? parsed
        : parsed && Array.isArray((parsed as any)["@graph"])
          ? (parsed as any)["@graph"]
          : [parsed];
      for (const n of nodes) {
        const t = (n as any)?.["@type"];
        const types = Array.isArray(t) ? t : t ? [t] : [];
        const isOrg = types.map((x) => String(x).toLowerCase()).includes("organization");
        if (!isOrg) continue;
        const desc = ((n as any)?.description || (n as any)?.slogan || "")?.toString?.().trim?.() || null;
        const url = ((n as any)?.url || "")?.toString?.().trim?.() || null;
        const logoRaw = (n as any)?.logo;
        const logo =
          typeof logoRaw === "string"
            ? logoRaw
            : logoRaw && typeof logoRaw === "object"
              ? ((logoRaw as any)?.url || (logoRaw as any)?.["@id"] || null)
              : null;
        const addr = (n as any)?.address;
        const location =
          addr && typeof addr === "object"
            ? [addr.addressLocality, addr.addressRegion, addr.addressCountry].filter(Boolean).join(", ") || null
            : null;
        return { description: desc, logo: logo ? String(logo).trim() : null, website: url ? String(url).trim() : null, location };
      }
    } catch {
      // ignore malformed json-ld blocks
    }
  }
  return {};
}

export async function enrichCompanyFromWebsite(args: {
  websiteUrl: string;
  timeoutMs?: number;
  maxBytes?: number;
}): Promise<CompanyWebsiteEnrichment> {
  const notes: string[] = [];
  const timeoutMs = Math.min(15_000, Math.max(3_000, Number(args.timeoutMs) || 8_000));
  const maxBytes = Math.min(1_200_000, Math.max(50_000, Number(args.maxBytes) || 450_000));

  const norm = normalizeUrlForRegistry(args.websiteUrl);
  const host = normalizeHost(norm.host);
  if (!host) {
    return { website: null, description: null, logo_url: null, notes: ["invalid_host"] };
  }
  const deny = matchDenylistHost(host);
  if (deny.matched) {
    return { website: null, description: null, logo_url: null, notes: ["blocked_by_denylist"] };
  }

  let res: Response;
  try {
    res = await fetch(norm.normalizedUrl, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return { website: norm.normalizedUrl, description: null, logo_url: null, notes: ["fetch_failed"] };
  }

  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  if (!res.ok) {
    return { website: (res.url || norm.normalizedUrl).toString(), description: null, logo_url: null, notes: ["http_error"] };
  }
  if (!contentType.includes("text/html")) {
    return { website: (res.url || norm.normalizedUrl).toString(), description: null, logo_url: null, notes: ["unsupported_content_type"] };
  }

  // Read limited bytes (avoid huge marketing pages).
  const reader = res.body?.getReader?.();
  if (!reader) {
    const html = await res.text();
    const base = (res.url || norm.normalizedUrl).toString();
    if (landedOnAnotherHost(norm.normalizedUrl, base)) {
      notes.push("redirected_off_host");
    }
    const offHost = notes.includes("redirected_off_host");
    const desc =
      extractMeta(html, "og:description") || extractMeta(html, "twitter:description") || extractMeta(html, "description");
    const img = extractMeta(html, "og:logo");
    const safeDesc = !offHost && desc && !isBoilerplateDescription(desc) && !blurbConflictsWithHost(desc, base) ? desc.slice(0, 280) : null;
    return {
      website: base,
      description: safeDesc,
      logo_url: chooseDisplayedLogo([absolutizeUrl(base, img), absolutizeUrl(base, "/favicon.ico")], base),
      notes,
    };
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  try {
    reader.releaseLock();
  } catch {
    // ignore
  }

  // Edge-safe concatenation (Buffer is not available on edge runtimes).
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  const html = new TextDecoder("utf-8").decode(merged);
  const base = (res.url || norm.normalizedUrl).toString();

  const jsonld = extractJsonLdOrganization(html);
  const description =
    extractMeta(html, "og:description") || extractMeta(html, "twitter:description") || extractMeta(html, "description");
  const icon =
    extractLinkHref(html, "apple-touch-icon") ||
    extractLinkHref(html, "icon") ||
    extractMeta(html, "og:logo") ||
    jsonld.logo ||
    null;
  const website = jsonld.website ? jsonld.website : base;
  const logoUrl = chooseDisplayedLogo([absolutizeUrl(base, icon)], website);
  const offHost = landedOnAnotherHost(norm.normalizedUrl, base) || landedOnAnotherHost(norm.normalizedUrl, website);
  if (offHost) notes.push("redirected_off_host");

  const rawDescription = description || jsonld.description || "";
  const safeDescription =
    !offHost &&
    rawDescription &&
    !isBoilerplateDescription(rawDescription) &&
    !blurbConflictsWithHost(rawDescription, website)
      ? String(rawDescription).slice(0, 280)
      : null;
  if (!safeDescription) notes.push("no_description_meta");
  if (!logoUrl) notes.push("no_logo_meta");

  return {
    website,
    description: safeDescription,
    logo_url: logoUrl,
    location: jsonld.location || null,
    notes,
  };
}

