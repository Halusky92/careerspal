import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../lib/supabaseServerAuth";
import { parseAlertPrefs, serializeAlertPrefs } from "../../../lib/alertPrefs";

export const runtime = "nodejs";

const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const body = (await request.json()) as {
    email?: string;
    preference?: string;
    categories?: string[] | string;
    minSalary?: number;
    region?: string;
  };
  const email = (body.email || "").trim().toLowerCase();
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email." }, { status: 400 });
  }

  const forwarded = await fetch(new URL("/api/alerts/subscribe", request.url), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      query: body.preference,
      categories: body.categories,
      minSalary: body.minSalary,
      region: body.region,
    }),
  });
  const payload = await forwarded.json();
  if (!forwarded.ok) {
    return NextResponse.json({ error: payload.error || "Unable to subscribe." }, { status: forwarded.status });
  }
  const { data, error } = await supabaseAdmin
    .from("subscribers")
    .select("email,preference,created_at")
    .eq("email", email)
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
  const { data: existing } = await supabaseAdmin.from("subscribers").select("preference").eq("email", email).maybeSingle();
  const merged = serializeAlertPrefs(parseAlertPrefs(preference, parseAlertPrefs(existing?.preference || null).token));
  const { data, error } = await supabaseAdmin
    .from("subscribers")
    .upsert({ email, preference: merged }, { onConflict: "email" })
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
