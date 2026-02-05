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
  const user = {
    name: profile.full_name,
    email: profile.email,
    image: profile.avatar_url,
    role: profile.role,
    isOnboarded: profile.is_onboarded,
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
  };

  const nextRole =
    body.role && ALLOWED_ROLES.has(body.role) ? body.role : undefined;

  const updates: Record<string, string | boolean | null | undefined> = {
    full_name: body.name?.trim() || undefined,
    avatar_url: body.image?.trim() || undefined,
    role: nextRole,
    is_onboarded: body.name ? true : undefined,
  };

  const { data: updatedProfile } = await supabaseAdmin
    .from("profiles")
    .update(updates)
    .eq("id", auth.profile.id)
    .select("full_name, email, avatar_url, role, is_onboarded")
    .single();

  const updated = updatedProfile
    ? {
        name: updatedProfile.full_name,
        email: updatedProfile.email,
        image: updatedProfile.avatar_url,
        role: updatedProfile.role,
        isOnboarded: updatedProfile.is_onboarded,
      }
    : null;

  return NextResponse.json({ user: updated });
}
