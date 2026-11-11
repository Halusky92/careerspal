import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { mapSupabaseJob, SupabaseJobRow } from "../../../../lib/supabaseJobs";
import { isOnNicheJob } from "../../../../lib/nicheScope";
import { applyLiveBoardFilter } from "../../../../lib/liveBoard";
import { boardTierFromRequest } from "../../../../lib/boardAccessServer";
import { cappedListTake } from "../../../../lib/publicJobBoard";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit") || "8");
  const requested = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : 8;
  const take = cappedListTake(await boardTierFromRequest(request), requested);
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }
  const { data } = await applyLiveBoardFilter(
    supabaseAdmin
      .from("jobs")
      .select(
        "id,title,description,location,remote_policy,type,salary,posted_at_text,timestamp,category,apply_url,company_description,company_website,logo_url,tags,tools,benefits,keywords,match_score,is_featured,status,plan_type,plan_price,plan_currency,views,matches,stripe_payment_status,stripe_session_id,companies(name,slug,logo_url,website,description,verified)",
      )
      .eq("status", "published"),
  )
    .order("timestamp", { ascending: false })
    .limit(take);

  return NextResponse.json(
    { jobs: ((data as SupabaseJobRow[]) || []).map(mapSupabaseJob).filter((job) => isOnNicheJob(job)) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
