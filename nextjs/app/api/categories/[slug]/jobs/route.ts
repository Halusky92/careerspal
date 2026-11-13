import { NextResponse } from "next/server";
import { getCategoryHub, jobMatchesHub } from "../../../../../lib/categories";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { mapSupabaseJob, type SupabaseJobRow } from "../../../../../lib/supabaseJobs";
import { isOnNicheJob } from "../../../../../lib/nicheScope";
import { applyLiveBoardFilter } from "../../../../../lib/liveBoard";
import { publicListTierFromRequest } from "../../../../../lib/boardAccessServer";
import { buildPublicList, listCacheHeaders, PUBLIC_CATEGORY_JOB_LIMIT } from "../../../../../lib/publicListPreview";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const hub = getCategoryHub(slug);
  if (!hub) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }
  const { data, error } = await applyLiveBoardFilter(
    supabaseAdmin
      .from("jobs")
      .select(
        "id,title,description,location,remote_policy,type,salary,posted_at_text,timestamp,category,apply_url,company_description,company_website,logo_url,tags,tools,benefits,keywords,match_score,is_featured,status,plan_type,plan_price,plan_currency,views,matches,companies(name,slug,logo_url,website,description,verified)",
      )
      .eq("status", "published"),
  )
    .order("timestamp", { ascending: false })
    .range(0, 499);

  if (error) {
    return NextResponse.json({ error: "Category is unavailable." }, { status: 500 });
  }
  const jobs = ((data as unknown as SupabaseJobRow[] | null) || [])
    .map(mapSupabaseJob)
    .filter((job) => isOnNicheJob(job) && jobMatchesHub(job, hub));
  const tier = await publicListTierFromRequest(request);
  return NextResponse.json(buildPublicList(jobs, tier, PUBLIC_CATEGORY_JOB_LIMIT), { headers: listCacheHeaders() });
};
