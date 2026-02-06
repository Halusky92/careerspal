import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

type CompanyRow = { companies?: { name?: string | null } | Array<{ name?: string | null }> | null };

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }
  const { data: jobs } = await supabaseAdmin
    .from("jobs")
    .select("companies(name)")
    .eq("status", "published");
  const companies = new Set(
    (jobs as CompanyRow[] | null || [])
      .map((job) => (Array.isArray(job.companies) ? job.companies[0]?.name : job.companies?.name))
      .filter(Boolean),
  );
  return NextResponse.json(
    { count: companies.size },
    { headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=600" } },
  );
}
