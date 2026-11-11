import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { boardTierFromRequest } from "../../../../lib/boardAccessServer";
import { PAID_JOBS_PAGE_MAX } from "../../../../lib/boardAccess";
import { cappedListTake } from "../../../../lib/publicJobBoard";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") === "invite_only" ? "invite_only" : "published";
  const limitParam = Number(searchParams.get("limit") || String(PAID_JOBS_PAGE_MAX));
  const requested = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, PAID_JOBS_PAGE_MAX) : PAID_JOBS_PAGE_MAX;
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }
  const tier = await boardTierFromRequest(request);
  const take = cappedListTake(tier, requested);
  const { data: jobs } = await supabaseAdmin
    .from("jobs")
    .select("id")
    .eq("status", status)
    .order("timestamp", { ascending: false })
    .limit(take);
  return NextResponse.json(
    { ids: (jobs || []).map((job) => job.id), access: tier },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
