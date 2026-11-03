import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { parseAlertQuery, serializeAlertQuery } from "../../../../lib/categories";
import { newUnsubToken, parseAlertPrefs, serializeAlertPrefs, type AlertRegion } from "../../../../lib/alertPrefs";
import { getPublicSiteUrl } from "../../../../lib/alerts/siteUrl";
import { renderAlertEmail } from "../../../../lib/alerts/emailTemplate";

export const runtime = "nodejs";

const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    categories?: string[] | string;
    query?: string;
    minSalary?: number | string;
    region?: string;
  };

  const email = (body.email || "").trim().toLowerCase();
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  const categories = serializeAlertQuery(
    parseAlertQuery(Array.isArray(body.categories) ? body.categories.join(",") : body.categories || body.query || "all"),
  );
  const minSalaryRaw = Number(body.minSalary);
  const minSalary = Number.isFinite(minSalaryRaw) && minSalaryRaw > 0 ? minSalaryRaw : null;
  const region = (body.region || "anywhere").toString() as AlertRegion;

  const { data: existing } = await supabaseAdmin.from("subscribers").select("email,preference").eq("email", email).maybeSingle();
  const current = parseAlertPrefs(existing?.preference || null);
  const prefs = {
    categories,
    minSalary,
    region,
    token: current.token || newUnsubToken(),
    lastSentAt: current.lastSentAt || null,
  };

  const { error } = await supabaseAdmin.from("subscribers").upsert({ email, preference: serializeAlertPrefs(prefs) }, { onConflict: "email" });
  if (error) {
    return NextResponse.json({ error: "Unable to subscribe." }, { status: 500 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    try {
      const baseUrl = getPublicSiteUrl();
      const unsub = `${baseUrl}/api/alerts/unsubscribe?token=${encodeURIComponent(prefs.token)}`;
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from: process.env.RESEND_FROM || "CareersPal <onboarding@resend.dev>",
        to: email,
        subject: "You’re subscribed to CareersPal alerts",
        html: renderAlertEmail({
          title: "Alerts are on",
          preheader: "Two emails a week with matching Ops and Systems roles.",
          introHtml: `<p style="margin:0 0 12px;">We’ll email matching published roles twice a week. Each role opens on CareersPal first.</p>
          <p style="margin:0;">No password. Stop anytime with the unsubscribe link.</p>`,
          cta: { label: "Browse jobs", href: `${baseUrl}/jobs` },
          unsubscribeUrl: unsub,
        }),
        headers: {
          "List-Unsubscribe": `<${unsub}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
    } catch {
      // Subscription is saved even if the confirmation email fails.
    }
  }

  return NextResponse.json({ ok: true, existing: Boolean(existing) });
}
