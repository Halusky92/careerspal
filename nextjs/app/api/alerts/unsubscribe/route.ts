import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { parseAlertPrefs } from "../../../../lib/alertPrefs";
import { getPublicSiteUrl } from "../../../../lib/alerts/siteUrl";

export const runtime = "nodejs";

const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

async function removeSubscriber(args: { token?: string; email?: string }) {
  if (!supabaseAdmin) return { ok: false as const, error: "Supabase not configured." };
  const token = (args.token || "").trim().replace(/[^a-f0-9]/gi, "");
  const email = (args.email || "").trim().toLowerCase();

  if (token) {
    const { data } = await supabaseAdmin.from("subscribers").select("email,preference").ilike("preference", `%${token}%`);
    const match = (data || []).find((row) => parseAlertPrefs(row.preference).token === token);
    if (match?.email) {
      await supabaseAdmin.from("subscribers").delete().eq("email", match.email);
      return { ok: true as const, email: match.email };
    }
    return { ok: false as const, error: "Missing unsubscribe token." };
  }

  if (email && isValidEmail(email)) {
    await supabaseAdmin.from("subscribers").delete().eq("email", email);
    return { ok: true as const, email };
  }

  return { ok: false as const, error: "Missing unsubscribe token." };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const result = await removeSubscriber({
    token: url.searchParams.get("token") || "",
    email: url.searchParams.get("email") || "",
  });
  const site = getPublicSiteUrl();
  if (!result.ok) {
    return NextResponse.redirect(`${site}/alerts/unsubscribe?error=1`);
  }
  return NextResponse.redirect(`${site}/alerts/unsubscribe?done=1`);
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const body = (await request.json().catch(() => ({}))) as { token?: string; email?: string };
  const result = await removeSubscriber({
    token: body.token || url.searchParams.get("token") || "",
    email: body.email || url.searchParams.get("email") || "",
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
