import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../lib/supabaseServerAuth";
import { isProfileVisibility } from "../../../../lib/profileVisibility";

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!token || !supabaseAdmin) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, avatar_url, headline, bio, hobbies, profile_visibility, profile_share_token, role")
    .eq("profile_share_token", token)
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const visibility = isProfileVisibility(data.profile_visibility) ? data.profile_visibility : "private";
  if (visibility === "private") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (visibility === "employers") {
    const auth = await getSupabaseProfile(request);
    const isOwner = auth?.profile?.id === data.id;
    const isEmployer = auth?.profile?.role === "employer" || auth?.profile?.role === "admin";
    if (!isOwner && !isEmployer) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
  }

  return NextResponse.json({
    person: {
      name: data.full_name || "Seeker",
      image: data.avatar_url || "",
      headline: data.headline || "",
      bio: data.bio || "",
      hobbies: data.hobbies || "",
      visibility,
    },
  });
}
