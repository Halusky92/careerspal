import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { mapSupabaseJob, SupabaseJobRow } from "../../../../lib/supabaseJobs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") || "").trim();
  const location = (searchParams.get("location") || "").trim();
  const type = searchParams.get("type") || "";
  const category = searchParams.get("category") || "";
  const planType = searchParams.get("planType") || "";
  const remote = searchParams.get("remote") || "";
  const status = searchParams.get("status") || "published";
  const limitParam = Number(searchParams.get("limit") || "0");
  const skipParam = Number(searchParams.get("skip") || "0");
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : undefined;
  const skip = Number.isFinite(skipParam) && skipParam > 0 ? skipParam : undefined;
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  let queryBuilder = supabaseAdmin
    .from("jobs")
    .select(
      "id,title,description,location,remote_policy,type,salary,posted_at_text,timestamp,category,apply_url,company_description,company_website,logo_url,tags,tools,benefits,keywords,match_score,is_featured,status,plan_type,plan_price,plan_currency,views,matches,companies(name,logo_url,website,description)",
      { count: "exact" },
    )
    .eq("status", status)
    .order("timestamp", { ascending: false });

  if (query) {
    queryBuilder = queryBuilder.or(
      `title.ilike.%${query}%,description.ilike.%${query}%,keywords.ilike.%${query}%,companies.name.ilike.%${query}%`,
    );
  }
  if (location) {
    queryBuilder = queryBuilder.ilike("location", `%${location}%`);
  }
  if (type) {
    queryBuilder = queryBuilder.eq("type", type);
  }
  if (category) {
    queryBuilder = queryBuilder.eq("category", category);
  }
  if (planType) {
    queryBuilder = queryBuilder.eq("plan_type", planType);
  }
  if (remote) {
    queryBuilder = queryBuilder.ilike("remote_policy", `%${remote}%`);
  }
  if (limit && typeof skip === "number") {
    queryBuilder = queryBuilder.range(skip, skip + limit - 1);
  } else if (limit) {
    queryBuilder = queryBuilder.range(0, limit - 1);
  }

  const { data, count } = await queryBuilder;

  return NextResponse.json(
    { jobs: (data as SupabaseJobRow[]).map(mapSupabaseJob), total: count ?? 0 },
    { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" } },
  );
}
