import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../lib/supabaseServerAuth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin
    .from("subscribers")
    .select("email,preference,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Unable to load subscribers." }, { status: 500 });
  }

  const subscribers = (data || []).map((item) => ({
    email: item.email,
    preference: item.preference,
    joinedAt: item.created_at,
  }));

  return NextResponse.json({ subscribers });
}

export async function DELETE(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const body = (await request.json()) as { email?: string };
  const email = (body.email || "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Missing email." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("subscribers").delete().eq("email", email);
  if (error) {
    return NextResponse.json({ error: "Unable to delete subscriber." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
