import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../lib/supabaseServerAuth";

export const runtime = "nodejs";

const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const body = (await request.json()) as { email?: string; preference?: string };
  const email = (body.email || "").trim().toLowerCase();
  const preference = (body.preference || "All").trim();

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("subscribers")
    .upsert(
      { email, preference },
      { onConflict: "email" },
    )
    .select("email,preference,created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "Unable to subscribe." }, { status: 500 });
  }

  return NextResponse.json({ message: "Subscription confirmed.", subscriber: data });
}

export async function GET(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (!auth?.profile?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }
  const email = auth.profile.email.trim().toLowerCase();
  const { data } = await supabaseAdmin
    .from("subscribers")
    .select("email,preference,created_at")
    .eq("email", email)
    .maybeSingle();
  return NextResponse.json({ subscriber: data || null });
}

export async function PATCH(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (!auth?.profile?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }
  const body = (await request.json()) as { preference?: string };
  const preference = (body.preference || "").trim();
  if (!preference) {
    return NextResponse.json({ error: "Missing preference." }, { status: 400 });
  }
  const email = auth.profile.email.trim().toLowerCase();
  const { data, error } = await supabaseAdmin
    .from("subscribers")
    .upsert({ email, preference }, { onConflict: "email" })
    .select("email,preference,created_at")
    .single();
  if (error) {
    return NextResponse.json({ error: "Unable to update alerts." }, { status: 500 });
  }
  return NextResponse.json({ subscriber: data });
}

export async function DELETE(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (!auth?.profile?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }
  const email = auth.profile.email.trim().toLowerCase();
  await supabaseAdmin.from("subscribers").delete().eq("email", email);
  if (auth.profile.id) {
    await supabaseAdmin.from("alerts").delete().eq("user_id", auth.profile.id);
  }
  return NextResponse.json({ success: true });
}
