import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../lib/supabaseServerAuth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit") || "0");
  const take = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 50) : undefined;
  const auth = await getSupabaseProfile(request);
  if (!auth?.profile) {
    return NextResponse.json({ alerts: [] });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const profileId = auth.profile.id;
  if (!profileId) {
    return NextResponse.json({ alerts: [] });
  }
  const { data } = await supabaseAdmin
    .from("alerts")
    .select("id, query, location, created_at, last_run_at")
    .eq("user_id", profileId)
    .order("created_at", { ascending: false })
    .range(0, take ? take - 1 : 999);
  return NextResponse.json(
    { alerts: data || [] },
    { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=120" } },
  );
}

export async function POST(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (!auth?.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { query?: string };
  const query = body?.query?.trim();
  if (!query) {
    return NextResponse.json({ error: "Missing query." }, { status: 400 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const profileId = auth.profile.id;
  if (!profileId) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  const { data: existing } = await supabaseAdmin
    .from("alerts")
    .select("id, query, location, created_at, last_run_at")
    .eq("user_id", profileId)
    .eq("query", query)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ alert: existing, existing: true });
  }
  const { data } = await supabaseAdmin
    .from("alerts")
    .insert({ user_id: profileId, query })
    .select("id, query, location, created_at, last_run_at")
    .single();
  return NextResponse.json({ alert: data }, { status: 201 });
}

export async function DELETE(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (!auth?.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { id?: string };
  if (!body?.id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const profileId = auth.profile.id;
  if (!profileId) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  const { data: existing } = await supabaseAdmin
    .from("alerts")
    .select("id")
    .eq("id", body.id)
    .eq("user_id", profileId)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: "Alert not found." }, { status: 404 });
  }
  await supabaseAdmin.from("alerts").delete().eq("id", body.id);
  return NextResponse.json({ success: true });
}
