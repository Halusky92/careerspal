import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { mapSupabaseJob, type SupabaseJobRow } from "../../../../../lib/supabaseJobs";
import { applyLiveBoardFilter } from "../../../../../lib/liveBoard";
import { isOnNicheJob } from "../../../../../lib/nicheScope";
import { resolveCategoryHub } from "../../../../../lib/categories";
import { buildPublicList, listCacheHeaders, PUBLIC_RELATED_JOB_LIMIT } from "../../../../../lib/publicListPreview";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }
  const { data: current } = await supabaseAdmin
    .from("jobs")
    .select("id,title,category,description,status")
    .eq("id", id)
    .maybeSingle();
  const hub = current ? resolveCategoryHub({ title: current.title, category: current.category }) : null;
  if (!hub) {
    return NextResponse.json({ jobs: [], total: 0, access: "guest" }, { headers: listCacheHeaders() });
  }

  const { data } = await applyLiveBoardFilter(
    supabaseAdmin
      .from("jobs")
      .select(
        "id,title,description,location,remote_policy,type,salary,posted_at_text,timestamp,category,apply_url,company_description,company_website,logo_url,tags,tools,benefits,keywords,match_score,is_featured,status,plan_type,plan_price,plan_currency,views,matches,companies(name,slug,logo_url,website,description,verified)",
      )
      .eq("status", "published")
      .neq("id", id),
  )
    .order("timestamp", { ascending: false })
    .range(0, 39);

  const jobs = ((data as unknown as SupabaseJobRow[] | null) || [])
    .map(mapSupabaseJob)
    .filter((job) => isOnNicheJob(job) && resolveCategoryHub(job)?.slug === hub.slug);
  const list = buildPublicList(jobs, "guest", PUBLIC_RELATED_JOB_LIMIT);
  return NextResponse.json(list, { headers: listCacheHeaders() });
}
