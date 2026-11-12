import type { SupabaseClient } from "@supabase/supabase-js";
import { enrichCompanyFromWebsite } from "../companyEnrichment";
import { hostnameFromWebsite, publicLogoUrlForWebsite } from "../companyLogoUrl";

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
