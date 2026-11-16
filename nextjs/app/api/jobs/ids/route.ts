import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { publicListTierFromRequest } from "../../../../lib/boardAccessServer";
import { listingsForViewer } from "../../../../lib/listingWindow";
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
  const tier = await publicListTierFromRequest(request);
  const take = cappedListTake(tier, requested);
  const { data: jobs } = await supabaseAdmin
    .from("jobs")
    .select("id,timestamp,published_at,created_at")
    .eq("status", status)
    .order("timestamp", { ascending: false })
    .limit(Math.min(take + 40, 80));
  const ids = listingsForViewer(jobs || [], tier).slice(0, take).map((job) => job.id);
  return NextResponse.json(
    { ids, access: tier },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
