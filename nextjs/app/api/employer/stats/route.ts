import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../lib/supabaseServerAuth";

export async function GET(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (!auth?.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const profileId = auth.profile.id;
  if (!profileId) return NextResponse.json({ jobs: 0, views: 0, matches: 0 });

  const { data } = await supabaseAdmin
    .from("jobs")
    .select("views,matches")
    .eq("created_by", profileId);
  const totals = (data || []).reduce(
    (acc, job) => ({
      jobs: acc.jobs + 1,
      views: acc.views + (job.views || 0),
      matches: acc.matches + (job.matches || 0),
    }),
    { jobs: 0, views: 0, matches: 0 },
  );
  return NextResponse.json(
    totals,
    { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=120" } },
  );
}
