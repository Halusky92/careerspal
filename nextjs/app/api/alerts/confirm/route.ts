import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { parseAlertPrefs, serializeAlertPrefs } from "../../../../lib/alertPrefs";
import { getPublicSiteUrl } from "../../../../lib/alerts/siteUrl";

export const runtime = "nodejs";

async function confirmSubscriber(tokenRaw: string) {
  if (!supabaseAdmin) return { ok: false as const, error: "Supabase not configured." };
  const token = (tokenRaw || "").trim().replace(/[^a-f0-9]/gi, "");
  if (!token) return { ok: false as const, error: "Missing confirm token." };

  const { data } = await supabaseAdmin.from("subscribers").select("email,preference").ilike("preference", `%${token}%`);
  const match = (data || []).find((row) => parseAlertPrefs(row.preference).token === token);
  if (!match?.email) return { ok: false as const, error: "Missing confirm token." };

  const prefs = parseAlertPrefs(match.preference);
  await supabaseAdmin
    .from("subscribers")
    .update({ preference: serializeAlertPrefs({ ...prefs, confirmed: true }) })
    .eq("email", match.email);
  return { ok: true as const, email: match.email };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const result = await confirmSubscriber(url.searchParams.get("token") || "");
  const site = getPublicSiteUrl();
  if (!result.ok) {
    return NextResponse.redirect(`${site}/alerts/confirm?error=1`);
  }
  return NextResponse.redirect(`${site}/alerts/confirm?done=1`);
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const body = (await request.json().catch(() => ({}))) as { token?: string };
  const result = await confirmSubscriber(body.token || url.searchParams.get("token") || "");
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
