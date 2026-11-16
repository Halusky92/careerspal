import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../lib/supabaseServerAuth";
import { REGISTERED_SAVED_SEARCHES } from "../../../lib/boardAccess";
import { boardTierFromRequest } from "../../../lib/boardAccessServer";
import { normalizeAlertTools, parseSavedSearch, serializeSavedSearch, type AlertRegion, type AlertWorkMode } from "../../../lib/alertPrefs";

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

  const body = (await request.json()) as {
    query?: string;
    minSalary?: number | string;
    region?: string;
    workMode?: string;
    tools?: string[] | string;
  };
  const query = body?.query?.trim();
  if (!query) {
    return NextResponse.json({ error: "Missing query." }, { status: 400 });
  }
  const salaryRaw = Number(body.minSalary);
  const storedQuery = serializeSavedSearch({
    categories: query,
    minSalary: Number.isFinite(salaryRaw) ? salaryRaw : null,
    region: (body.region || "anywhere") as AlertRegion,
    workMode: (body.workMode || "any") as AlertWorkMode,
    tools: normalizeAlertTools(body.tools),
  });
  const saved = parseSavedSearch(storedQuery);
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const profileId = auth.profile.id;
  if (!profileId) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  const { data: existingRows } = await supabaseAdmin
    .from("alerts")
    .select("id, query, location, created_at, last_run_at")
    .eq("user_id", profileId)
    .order("created_at", { ascending: true });
  const rows = existingRows || [];
  const sameCategory = rows.find((row) => parseSavedSearch(row.query).categories === saved.categories);
  const tier = await boardTierFromRequest(request);
  const replaceRow = sameCategory || (tier !== "paid" && rows.length >= REGISTERED_SAVED_SEARCHES ? rows[0] : null);
  if (replaceRow) {
    const { data: updated } = await supabaseAdmin
      .from("alerts")
      .update({ query: storedQuery })
      .eq("id", replaceRow.id)
      .select("id, query, location, created_at, last_run_at")
      .single();
    return NextResponse.json({ alert: updated || { ...replaceRow, query: storedQuery }, existing: true });
  }
  if (tier !== "paid" && rows.length >= REGISTERED_SAVED_SEARCHES) {
    return NextResponse.json(
      { error: "Free accounts can save one search. Premium unlocks more.", cap: REGISTERED_SAVED_SEARCHES },
      { status: 403 },
    );
  }
  const { data } = await supabaseAdmin
    .from("alerts")
    .insert({ user_id: profileId, query: storedQuery })
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
