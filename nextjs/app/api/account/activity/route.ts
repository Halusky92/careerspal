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

  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit") || "10");
  const take = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : 10;

  const profileId = auth.profile.id;

  const [savedJobs, files] = await Promise.all([
    supabaseAdmin
      .from("saved_jobs")
      .select("job_id, created_at")
      .eq("user_id", profileId)
      .order("created_at", { ascending: false })
      .range(0, take - 1),
    supabaseAdmin
      .from("files")
      .select("name, created_at")
      .eq("user_id", profileId)
      .order("created_at", { ascending: false })
      .range(0, take - 1),
  ]);

  return NextResponse.json(
    {
      activity: {
        savedJobs: (savedJobs.data || []).map((item) => ({
          jobId: item.job_id,
          createdAt: item.created_at,
        })),
        files: (files.data || []).map((item) => ({
          name: item.name,
          createdAt: item.created_at,
        })),
      },
    },
    { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=120" } },
  );
}
