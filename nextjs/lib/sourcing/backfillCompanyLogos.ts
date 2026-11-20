import type { SupabaseClient } from "@supabase/supabase-js";
import { enrichCompanyFromWebsite } from "../companyEnrichment";
import { hostnameFromWebsite, isGenericHostedIcon, officialWebsiteUrl, publicLogoUrlForWebsite, soleCompanyWebsiteFromText } from "../companyLogoUrl";
import { NEW_BADGE_MS } from "../listingWindow";
import { fetchAshbyBoardBrand, type AshbyBoardBrand } from "./ashbyBrand";
import { inferAshbyBoardTokenFromUrl } from "./connectors/ashby";

type AdminSb = SupabaseClient<any, "public", any>;

type LogoCompany = {
  id: string;
  website?: string | null;
  logo_url?: string | null;
};

type LogoEnrichment = {
  logo_url?: string | null;
};

/**
 * A stored company site wins. Otherwise one site named in the employer's own posting.
 * A name is never turned into a domain, and an ATS or directory address is not a site.
 */
export function confirmedLogoWebsite(website: string | null | undefined, descriptions: string[]): string | null {
  if (hostnameFromWebsite(website)) return String(website).trim();
  return soleCompanyWebsiteFromText(descriptions.filter(Boolean).join("\n"));
}

/**
 * Fills a missing logo only from a website already stored for that company.
 * A name is never turned into a domain, and an ATS board address is not a company site.
 */
export async function backfillMissingCompanyLogos(
  sb: AdminSb,
  limit = 80,
  enrich: (input: { websiteUrl: string }) => Promise<LogoEnrichment> = enrichCompanyFromWebsite,
) {
  const { data: companies, error } = await sb
    .from("companies")
    .select("id,website,logo_url")
    .order("id", { ascending: false })
    .limit(500);

  if (error) throw error;

  let updated = 0;
  let jobsUpdated = 0;
  let fetched = 0;
  let skipped = 0;

  for (const company of (companies || []) as LogoCompany[]) {
    let logo = String(company.logo_url || "").trim();
    if (!logo) {
      const website = hostnameFromWebsite(company.website) ? String(company.website || "").trim() : "";
      if (!website || fetched >= limit) {
        skipped += 1;
        continue;
      }
      fetched += 1;
      try {
        const enriched = await enrich({ websiteUrl: website });
        logo = String(enriched.logo_url || "").trim();
      } catch {
        logo = "";
      }
      if (!logo) logo = publicLogoUrlForWebsite(website) || "";
      if (!logo) {
        skipped += 1;
        continue;
      }
      const write = await sb.from("companies").update({ logo_url: logo }).eq("id", company.id);
      if (write.error) throw new Error(write.error.message || "Company logo update failed.");
      updated += 1;
    }

    const jobs = await sb.from("jobs").update({ logo_url: logo }).eq("company_id", company.id).is("logo_url", null).select("id");
    if (jobs.error) throw new Error(jobs.error.message || "Job logo update failed.");
    jobsUpdated += Array.isArray(jobs.data) ? jobs.data.length : 0;
  }

  return {
    scanned: companies?.length || 0,
    missing: skipped,
    updated,
    jobsUpdated,
    fetched,
    skipped,
    websitesGuessed: 0,
  };
}

type RecentJobRow = {
  company_id?: string | null;
  apply_url?: string | null;
  description?: string | null;
  logo_url?: string | null;
  companies?: { id?: string | null; website?: string | null; logo_url?: string | null } | null;
};

/** Logos for published companies. The New window is the default; null keeps walking older boards that are still missing a logo or site. */
export async function backfillRecentPublishedLogos(
  sb: AdminSb,
  opts: {
    sinceMs?: number | null;
    fetchLimit?: number;
    enrich?: (input: { websiteUrl: string }) => Promise<LogoEnrichment>;
    loadAshbyBrand?: (token: string) => Promise<AshbyBoardBrand>;
  } = {},
) {
  const sinceMs = opts.sinceMs === undefined ? NEW_BADGE_MS : opts.sinceMs;
  const fetchLimit = opts.fetchLimit ?? 20;
  const enrich = opts.enrich ?? enrichCompanyFromWebsite;
  const loadAshbyBrand = opts.loadAshbyBrand ?? fetchAshbyBoardBrand;
  let query = sb
    .from("jobs")
    .select("company_id,apply_url,description,logo_url,companies(id,website,logo_url)")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(400);
  if (sinceMs !== null) {
    const since = new Date(Date.now() - sinceMs).toISOString();
    query = query.or(`published_at.gte.${since},created_at.gte.${since}`);
  }
  const { data, error } = await query;
  if (error) throw error;

  const byCompany = new Map<string, { website: string | null; logo: string; descriptions: string[]; jobsMissing: boolean; ashbyTokens: Set<string> }>();
  for (const row of (data || []) as RecentJobRow[]) {
    const company = row.companies;
    const id = String(company?.id || row.company_id || "").trim();
    if (!id) continue;
    const current = byCompany.get(id) || {
      website: company?.website ?? null,
      logo: String(company?.logo_url || "").trim(),
      descriptions: [],
      jobsMissing: false,
      ashbyTokens: new Set<string>(),
    };
    if (row.description) current.descriptions.push(String(row.description));
    if (!String(row.logo_url || "").trim()) current.jobsMissing = true;
    const token = inferAshbyBoardTokenFromUrl(String(row.apply_url || ""));
    if (token) current.ashbyTokens.add(token);
    byCompany.set(id, current);
  }

  let updated = 0;
  let jobsUpdated = 0;
  let fetched = 0;
  let skipped = 0;
  let websitesFromPosting = 0;
  let websitesFromBoard = 0;

  for (const [id, company] of byCompany) {
    let logo = company.logo;
    const logoIsWeak = !logo || isGenericHostedIcon(logo);
    const storedSite = hostnameFromWebsite(company.website) ? String(company.website).trim() : "";
    const tokens = [...company.ashbyTokens];
    if (logoIsWeak || (!storedSite && tokens.length === 1)) {
      let website = confirmedLogoWebsite(company.website, company.descriptions);
      let websiteFromBoard = false;
      if (tokens.length === 1 && fetched < fetchLimit && (logoIsWeak || !website)) {
        fetched += 1;
        try {
          const brand = await loadAshbyBrand(tokens[0]);
          if (logoIsWeak && brand.logoUrl) logo = brand.logoUrl;
          if (!website && brand.website) {
            website = brand.website;
            websiteFromBoard = true;
          }
        } catch {
          logo = logo || "";
        }
      }
      if (logoIsWeak && (!logo || isGenericHostedIcon(logo))) {
        if (website && fetched < fetchLimit) {
          fetched += 1;
          try {
            const enriched = await enrich({ websiteUrl: website });
            const found = String(enriched.logo_url || "").trim();
            if (found) logo = found;
          } catch {
            logo = logo || "";
          }
        }
        if ((!logo || isGenericHostedIcon(logo)) && website) logo = publicLogoUrlForWebsite(website) || "";
      }
      if (logoIsWeak && !logo) {
        skipped += 1;
        continue;
      }
      const patch: { logo_url?: string; website?: string } = {};
      if (logoIsWeak && logo !== company.logo) patch.logo_url = logo;
      const site = officialWebsiteUrl(website);
      if (!storedSite && site) {
        patch.website = site;
        if (websiteFromBoard) websitesFromBoard += 1;
        else websitesFromPosting += 1;
      }
      if (patch.logo_url || patch.website) {
        const write = await sb.from("companies").update(patch).eq("id", id);
        if (write.error) throw new Error(write.error.message || "Company logo update failed.");
        updated += 1;
      }
    }
    if (!company.jobsMissing && !logo) continue;
    const jobs = await sb.from("jobs").update({ logo_url: logo }).eq("company_id", id).is("logo_url", null).select("id");
    if (jobs.error) throw new Error(jobs.error.message || "Job logo update failed.");
    jobsUpdated += Array.isArray(jobs.data) ? jobs.data.length : 0;
  }

  return {
    scanned: byCompany.size,
    updated,
    jobsUpdated,
    fetched,
    skipped,
    websitesFromPosting,
    websitesFromBoard,
    websitesGuessed: 0,
  };
}
