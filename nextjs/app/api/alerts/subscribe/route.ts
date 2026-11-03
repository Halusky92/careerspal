import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { parseAlertQuery, serializeAlertQuery } from "../../../../lib/categories";
import { isGuestAlertConfirmed, newUnsubToken, parseAlertPrefs, serializeAlertPrefs, type AlertRegion } from "../../../../lib/alertPrefs";
import { getPublicSiteUrl } from "../../../../lib/alerts/siteUrl";
import { renderAlertEmail } from "../../../../lib/alerts/emailTemplate";
import { getResendFrom } from "../../../../lib/resendFrom";

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
  const alreadyConfirmed = Boolean(existing) && isGuestAlertConfirmed(current);
  const prefs = {
    categories,
    minSalary,
    region,
    token: current.token || newUnsubToken(),
    lastSentAt: current.lastSentAt || null,
    confirmed: alreadyConfirmed,
  };

  const { error } = await supabaseAdmin.from("subscribers").upsert({ email, preference: serializeAlertPrefs(prefs) }, { onConflict: "email" });
  if (error) {
    return NextResponse.json({ error: "Unable to subscribe." }, { status: 500 });
  }

  const pendingConfirm = !prefs.confirmed;
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey && pendingConfirm) {
    try {
      const baseUrl = getPublicSiteUrl();
      const confirm = `${baseUrl}/alerts/confirm?token=${encodeURIComponent(prefs.token)}`;
      const unsub = `${baseUrl}/api/alerts/unsubscribe?token=${encodeURIComponent(prefs.token)}`;
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from: getResendFrom(),
        to: email,
        subject: "Confirm your CareersPal alerts",
        html: renderAlertEmail({
          title: "Confirm your alerts",
          preheader: "Click the link to start Tuesday and Friday job emails.",
          introHtml: `<p style="margin:0 0 12px;">We got your request. Alerts stay off until you confirm this email.</p>
            <p style="margin:0;">Two messages a week. Each role opens on CareersPal first. No password.</p>`,
          cta: { label: "Confirm alerts", href: confirm },
          unsubscribeUrl: unsub,
          footerNote: "If you did not request this, ignore the email or unsubscribe.",
        }),
      });
    } catch {
      // Preference is saved even if the confirm email fails.
    }
  }

  return NextResponse.json({ ok: true, existing: Boolean(existing), pendingConfirm });
}
