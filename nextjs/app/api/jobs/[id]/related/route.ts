import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { mapSupabaseJob, SupabaseJobRow } from "../../../../../lib/supabaseJobs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }
  const { data: job } = await supabaseAdmin.from("jobs").select("category").eq("id", id).single();
  if (!job?.category) return NextResponse.json({ jobs: [] });

  const url = new URL(_request.url);
  const limitParam = Number(url.searchParams.get("limit") || "3");
  const take = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 10) : 3;

  const { data } = await supabaseAdmin
    .from("jobs")
    .select(
      "id,title,description,location,remote_policy,type,salary,posted_at_text,timestamp,category,apply_url,company_description,company_website,logo_url,tags,tools,benefits,keywords,match_score,is_featured,status,plan_type,plan_price,plan_currency,views,matches,companies(name,logo_url,website,description)",
    )
    .eq("status", "published")
    .eq("category", job.category)
    .neq("id", id)
    .order("created_at", { ascending: false })
    .limit(take);

  return NextResponse.json(
    { jobs: (data as SupabaseJobRow[]).map(mapSupabaseJob) },
    { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" } },
  );
}
