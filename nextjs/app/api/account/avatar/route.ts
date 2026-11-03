import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../lib/supabaseServerAuth";

const MAX_BYTES = 450_000;

export async function POST(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (!auth?.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const body = (await request.json()) as { dataUrl?: string };
  const dataUrl = (body.dataUrl || "").trim();
  if (!dataUrl.startsWith("data:image/")) {
    return NextResponse.json({ error: "Choose a JPG, PNG, or WebP image." }, { status: 400 });
  }
  if (dataUrl.length > MAX_BYTES) {
    return NextResponse.json({ error: "Photo is too large. Use a smaller image." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ avatar_url: dataUrl })
    .eq("id", auth.profile.id)
    .select("full_name, email, avatar_url, role, is_onboarded")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: "Could not save photo." }, { status: 500 });
  }

  return NextResponse.json({
    user: {
      name: data.full_name,
      email: data.email,
      image: data.avatar_url,
      role: data.role,
      isOnboarded: data.is_onboarded,
    },
  });
}

export async function DELETE(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (!auth?.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  await supabaseAdmin.from("profiles").update({ avatar_url: null }).eq("id", auth.profile.id);

  return NextResponse.json({ success: true });
}
