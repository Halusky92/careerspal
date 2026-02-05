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

  const { count } = await supabaseAdmin
    .from("saved_jobs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", profileId);
  return NextResponse.json(
    { count: count || 0 },
    { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=120" } },
  );
}
