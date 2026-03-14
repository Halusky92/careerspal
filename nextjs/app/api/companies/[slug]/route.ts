import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { mapSupabaseJob, SupabaseJobRow } from "../../../../lib/supabaseJobs";
import type { Company } from "../../../../types";

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
};

const mapCompany = (row: SupabaseCompanyRow): Company => ({
  name: row.name || "Unknown",
  logo: row.logo_url || "",
  website: row.website || "",
  description: row.description || "Company profile coming soon.",
  longDescription: row.long_description || row.description || "Company profile coming soon.",
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

  let { data: company } = await supabaseAdmin
    .from("companies")
    .select("id,name,slug,website,description,long_description,logo_url,location,employee_count")
    .eq("slug", slug)
    .single();

  // Self-heal fallback for legacy records without slug: try case-insensitive exact name match.
  if (!company) {
    const nameGuess = slug.replace(/-/g, " ").trim();
    const { data: byName } = await supabaseAdmin
      .from("companies")
      .select("id,name,slug,website,description,long_description,logo_url,location,employee_count")
      .ilike("name", nameGuess)
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

  const { data: jobs } = await supabaseAdmin
    .from("jobs")
    .select(
      "id,title,description,location,remote_policy,type,salary,posted_at_text,timestamp,category,apply_url,company_description,company_website,logo_url,tags,tools,benefits,keywords,match_score,is_featured,status,plan_type,plan_price,plan_currency,views,matches,stripe_payment_status,stripe_session_id,companies(name,logo_url,website,description)",
    )
    .eq("company_id", company.id)
    .eq("status", "published")
    .order("timestamp", { ascending: false });

  const mappedJobs = (jobs as SupabaseJobRow[] | null || []).map(mapSupabaseJob);

  return NextResponse.json({ company: mapCompany(company as SupabaseCompanyRow), jobs: mappedJobs });
};
