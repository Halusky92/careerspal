import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../lib/supabaseServerAuth";

const ALLOWED_ROLES = new Set(["candidate", "employer"]);

export async function GET(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (!auth?.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const profile = auth.profile;
  const extraRes = await supabaseAdmin
    .from("profiles")
    .select("headline, bio, hobbies, profile_visibility, profile_share_token")
    .eq("id", profile.id)
    .maybeSingle();
  const extras = extraRes.error ? null : extraRes.data;

  const user = {
    name: profile.full_name,
    email: profile.email,
    image: profile.avatar_url,
    role: profile.role,
    isOnboarded: profile.is_onboarded,
    headline: (extras as { headline?: string | null } | null)?.headline || "",
    bio: (extras as { bio?: string | null } | null)?.bio || "",
    hobbies: (extras as { hobbies?: string | null } | null)?.hobbies || "",
    visibility: (extras as { profile_visibility?: string | null } | null)?.profile_visibility || "private",
    shareToken: (extras as { profile_share_token?: string | null } | null)?.profile_share_token || "",
    createdAt: null,
  };

  return NextResponse.json({ user });
}

export async function PATCH(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (!auth?.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const body = (await request.json()) as {
    name?: string;
    image?: string;
    role?: string;
    headline?: string;
    bio?: string;
    hobbies?: string;
    visibility?: string;
  };

  const nextRole =
    body.role && ALLOWED_ROLES.has(body.role) ? body.role : undefined;

  const updates: Record<string, string | boolean | null | undefined> = {
    full_name: body.name?.trim() || undefined,
    avatar_url: body.image?.trim() || undefined,
    role: nextRole,
    is_onboarded: body.name ? true : undefined,
  };
  if (typeof body.headline === "string") updates.headline = body.headline.trim().slice(0, 120);
  if (typeof body.bio === "string") updates.bio = body.bio.trim().slice(0, 800);
  if (typeof body.hobbies === "string") updates.hobbies = body.hobbies.trim().slice(0, 200);
  if (body.visibility === "private" || body.visibility === "employers" || body.visibility === "link") {
    updates.profile_visibility = body.visibility;
    if (body.visibility !== "private") {
      const { data: current } = await supabaseAdmin
        .from("profiles")
        .select("profile_share_token")
        .eq("id", auth.profile.id)
        .maybeSingle();
      if (!(current as { profile_share_token?: string | null } | null)?.profile_share_token) {
        updates.profile_share_token = crypto.randomUUID();
      }
    }
  }

  const extraSelect =
    "full_name, email, avatar_url, role, is_onboarded, headline, bio, hobbies, profile_visibility, profile_share_token";
  let { data: updatedProfile, error } = await supabaseAdmin
    .from("profiles")
    .update(updates)
    .eq("id", auth.profile.id)
    .select(extraSelect)
    .single();
  if (error) {
    const {
      headline: _h,
      bio: _b,
      hobbies: _ho,
      profile_visibility: _v,
      profile_share_token: _t,
      ...withoutExtras
    } = updates;
    const retry = await supabaseAdmin
      .from("profiles")
      .update(withoutExtras)
      .eq("id", auth.profile.id)
      .select("full_name, email, avatar_url, role, is_onboarded")
      .single();
    updatedProfile = retry.data as typeof updatedProfile;
  }

  const updated = updatedProfile
    ? {
        name: updatedProfile.full_name,
        email: updatedProfile.email,
        image: updatedProfile.avatar_url,
        role: updatedProfile.role,
        isOnboarded: updatedProfile.is_onboarded,
        headline: (updatedProfile as { headline?: string | null }).headline || "",
        bio: (updatedProfile as { bio?: string | null }).bio || "",
        hobbies: (updatedProfile as { hobbies?: string | null }).hobbies || "",
        visibility: (updatedProfile as { profile_visibility?: string | null }).profile_visibility || "private",
        shareToken: (updatedProfile as { profile_share_token?: string | null }).profile_share_token || "",
      }
    : null;

  return NextResponse.json({ user: updated });
}
