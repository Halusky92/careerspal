import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../lib/supabaseServerAuth";
import { accountAlertRows, guestAlertRows } from "../../../../lib/adminInbox";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const [{ data, error }, { data: alerts }] = await Promise.all([
    supabaseAdmin.from("subscribers").select("email,preference,created_at").order("created_at", { ascending: false }),
    supabaseAdmin.from("alerts").select("user_id,query,location,created_at").order("created_at", { ascending: false }),
  ]);

  if (error) {
    return NextResponse.json({ error: "Unable to load subscribers." }, { status: 500 });
  }

  const guests = guestAlertRows(data || []);
  const userIds = [...new Set((alerts || []).map((row) => row.user_id).filter((id): id is string => Boolean(id)))];
  const { data: profiles } = userIds.length
    ? await supabaseAdmin.from("profiles").select("id,email").in("id", userIds)
    : { data: [] };
  const fromAccounts = accountAlertRows(alerts || [], profiles || []);
  const subscribers = [...guests, ...fromAccounts].map((row) => ({
    email: row.email,
    preference: row.label,
    joinedAt: row.joinedAt || "",
    source: row.source,
    confirmed: row.confirmed,
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
