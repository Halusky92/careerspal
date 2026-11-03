import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../lib/supabaseServerAuth";
import { toPublicPerson } from "../../../lib/publicPerson";

export async function GET(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (!auth?.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = auth.profile.role;
  if (role !== "employer" && role !== "admin") {
    return NextResponse.json({ error: "Employer sign-in required." }, { status: 403 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, avatar_url, headline, bio, hobbies, profile_share_token, profile_visibility")
    .eq("profile_visibility", "employers")
    .order("updated_at", { ascending: false })
    .limit(80);

  if (error) {
    return NextResponse.json({ people: [] });
  }

  return NextResponse.json({
    people: (data || [])
      .filter((row) => Boolean((row as { profile_share_token?: string }).profile_share_token))
      .map((row) => toPublicPerson(row)),
  });
}
