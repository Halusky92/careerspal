import type { SupabaseClient } from "@supabase/supabase-js";
import { enrichCompanyFromWebsite } from "../companyEnrichment";
import { hostnameFromWebsite, publicLogoUrlForWebsite } from "../companyLogoUrl";

const KNOWN_SITES: Record<string, string> = {
  linear: "https://linear.app",
  checkr: "https://www.checkr.com",
  pendo: "https://www.pendo.io",
};

type AdminSb = SupabaseClient<any, "public", any>;

async function guessWebsiteFromName(name: string): Promise<string | null> {
  const slug = (name || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (KNOWN_SITES[slug]) return KNOWN_SITES[slug];
  if (slug.length < 3) return null;
  const candidates = [
    `https://www.${slug}.com`,
    `https://www.${slug}.io`,
    `https://www.${slug}.app`,
    `https://${slug}.com`,
    `https://${slug}.io`,
    `https://${slug}.app`,
  ];
  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(4500),
        headers: { "user-agent": "CareersPalLogoBot/1.0" },
      });
      if (!res.ok) continue;
      const host = new URL(res.url).hostname.replace(/^www\./i, "").toLowerCase();
      if (!host || !hostnameFromWebsite(`https://${host}`)) continue;
      if (host.includes("godaddy") || host.includes("sedo.com")) continue;
      return `https://${host}`;
    } catch {
      // try next candidate
    }
  }
  return null;
}

export async function backfillMissingCompanyLogos(sb: AdminSb, limit = 80) {
  const { data: companies, error } = await sb
    .from("companies")
    .select("id,name,website,logo_url")
    .order("id", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const missing = (companies || []).filter((c) => {
    const hasLogo = Boolean((c.logo_url || "").toString().trim());
    const officialSite = Boolean(hostnameFromWebsite(c.website));
    return !hasLogo || !officialSite;
  });
  let updated = 0;
  let websitesGuessed = 0;

  for (const company of missing) {
    const rawWebsite = ((company.website || "").toString().trim() || null) as string | null;
    let website = hostnameFromWebsite(rawWebsite) ? rawWebsite : null;
    if (!website) {
      website = await guessWebsiteFromName((company.name || "").toString());
      if (website) websitesGuessed += 1;
    }
    let logo: string | null = publicLogoUrlForWebsite(website);

    if (website) {
      try {
        const enr = await enrichCompanyFromWebsite({ websiteUrl: website });
        if (enr.logo_url) logo = enr.logo_url;
        if (enr.website && !((company.website || "").toString().trim())) website = enr.website;
      } catch {
        // keep favicon fallback
      }
    }

    if (!logo && !website) continue;

    const patch: Record<string, unknown> = {};
    if (logo) patch.logo_url = logo;
    if (website && hostnameFromWebsite(website) && !hostnameFromWebsite(company.website)) patch.website = website;
    if (Object.keys(patch).length === 0) continue;

    await sb.from("companies").update(patch).eq("id", company.id);
    if (logo) {
      await sb.from("jobs").update({ logo_url: logo }).eq("company_id", company.id).is("logo_url", null);
    }
    updated += 1;
  }

  return { scanned: companies?.length || 0, missing: missing.length, updated, websitesGuessed };
}
