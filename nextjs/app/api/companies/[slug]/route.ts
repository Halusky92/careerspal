import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { mapSupabaseJob, SupabaseJobRow } from "../../../../lib/supabaseJobs";
import type { Company } from "../../../../types";
import { enrichCompanyFromWebsite } from "../../../../lib/companyEnrichment";

type SupabaseCompanyRow = {
  id: string;
  name: string | null;
  slug: string | null;
  website: string | null;
  description: string | null;
  long_description: string | null;
  logo_url: string | null;
  location: string | null;
  employee_count: string | null;
  verified?: boolean | null;
};

const mapCompany = (row: SupabaseCompanyRow): Company => ({
  name: row.name || "Unknown",
  logo: row.logo_url || "",
  website: row.website || "",
  description: row.description || "Company profile coming soon.",
  longDescription: row.long_description || row.description || "Company profile coming soon.",
  verified: Boolean(row.verified),
  foundedYear: "—",
  employeeCount: row.employee_count || "—",
  headquarters: row.location || "Remote",
  images: [],
  techStack: [],
  socialLinks: {},
});

export const GET = async (_request: Request, context: { params: Promise<{ slug: string }> }) => {
  const { slug } = await context.params;
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  // Be resilient to legacy data issues (missing slug trigger, duplicates by case, etc.).
  // Use order+limit instead of `.single()` to avoid hard failures when more than one row matches.
  let { data: company } = await supabaseAdmin
    .from("companies")
    .select("id,name,slug,website,description,long_description,logo_url,location,employee_count,verified,updated_at")
    .eq("slug", slug)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Self-heal fallback for legacy records without slug: try case-insensitive exact name match.
  if (!company) {
    const nameGuess = slug.replace(/-/g, " ").trim();
    const { data: byName } = await supabaseAdmin
      .from("companies")
      .select("id,name,slug,website,description,long_description,logo_url,location,employee_count,verified,updated_at")
      .ilike("name", nameGuess)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (byName?.id) {
      company = byName as any;
      if (!byName.slug) {
        await supabaseAdmin.from("companies").update({ slug }).eq("id", byName.id);
        (company as any).slug = slug;
      }
    }
  }

  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  // Self-heal: derive website from latest published job if missing.
  try {
    const needsWebsite = !((company as any).website || "").toString().trim();
    if (needsWebsite) {
      const { data: jobRow } = await supabaseAdmin
        .from("jobs")
        .select("company_website,apply_url")
        .eq("company_id", company.id)
        .eq("status", "published")
        .order("timestamp", { ascending: false })
        .limit(1)
        .maybeSingle();

      const rawWebsite = (jobRow as any)?.company_website || null;
      const rawApply = (jobRow as any)?.apply_url || null;
      const pick = (value: string | null) => {
        const v = (value || "").trim();
        if (!v || v === "#" || v.startsWith("mailto:") || v.startsWith("/")) return null;
        try {
          const u = new URL(v);
          return `${u.protocol}//${u.hostname}`;
        } catch {
          return null;
        }
      };
      const derived = pick(rawWebsite) || pick(rawApply);
      if (derived) {
        await supabaseAdmin.from("companies").update({ website: derived }).eq("id", company.id);
        (company as any).website = derived;
      }
    }
  } catch {
    // ignore
  }

  // Conservative enrichment: if website exists but description/logo missing, fill from meta tags (no overwrites).
  try {
    const website = ((company as any).website || "").toString().trim();
    const needsDesc = !((company as any).description || "").toString().trim();
    const needsLogo = !((company as any).logo_url || "").toString().trim();
    if (website && (needsDesc || needsLogo)) {
      const enr = await enrichCompanyFromWebsite({ websiteUrl: website });
      const patch: Record<string, unknown> = {};
      if (needsDesc && enr.description) patch.description = enr.description;
      if (needsLogo && enr.logo_url) patch.logo_url = enr.logo_url;
      if (Object.keys(patch).length > 0) {
        await supabaseAdmin.from("companies").update(patch).eq("id", company.id);
        Object.assign(company as any, patch);
      }
    }
  } catch {
    // ignore
  }

  const { data: jobs } = await supabaseAdmin
    .from("jobs")
    .select(
      "id,title,description,location,remote_policy,type,salary,posted_at_text,timestamp,category,apply_url,company_description,company_website,logo_url,tags,tools,benefits,keywords,match_score,is_featured,status,plan_type,plan_price,plan_currency,views,matches,stripe_payment_status,stripe_session_id,companies(name,slug,logo_url,website,description)",
    )
    .eq("company_id", company.id)
    .eq("status", "published")
    .order("timestamp", { ascending: false });

  const mappedJobs = (jobs as SupabaseJobRow[] | null || []).map(mapSupabaseJob);

  return NextResponse.json({ company: mapCompany(company as SupabaseCompanyRow), jobs: mappedJobs });
};
