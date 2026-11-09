import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { boardTierFromRequest } from "../../../../lib/boardAccessServer";
import { PAID_JOBS_PAGE_MAX } from "../../../../lib/boardAccess";
import { loadPublishedBoardJobs, pagePublishedBoard } from "../../../../lib/publicJobBoard";

export async function GET(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }
  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit") || "0");
  const skipParam = Number(searchParams.get("skip") || "0");
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, PAID_JOBS_PAGE_MAX) : PAID_JOBS_PAGE_MAX;
  const skip = Number.isFinite(skipParam) && skipParam > 0 ? skipParam : 0;
  const tier = await boardTierFromRequest(request);
  const jobs = await loadPublishedBoardJobs(supabaseAdmin, {
    category: searchParams.get("category"),
    type: searchParams.get("type"),
    planType: searchParams.get("planType"),
    remote: searchParams.get("remote"),
  });
  const location = (searchParams.get("location") || "").trim().toLowerCase();
  const query = (searchParams.get("q") || "").trim().toLowerCase();
  const filtered = jobs.filter((job) => {
    if (location && !(job.location || "").toLowerCase().includes(location)) return false;
    if (!query) return true;
    const hay = `${job.title || ""} ${job.description || ""} ${job.company || ""} ${job.keywords || ""}`.toLowerCase();
    return hay.includes(query);
  });
  const page = pagePublishedBoard(filtered, tier, { skip, limit });
  return NextResponse.json(
    { jobs: page.jobs, total: page.total, visible: page.visible, access: page.access },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
