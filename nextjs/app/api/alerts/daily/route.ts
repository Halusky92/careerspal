import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { createJobSlug } from "../../../../lib/jobs";
import { formatSalaryDisplay } from "../../../../lib/formatSalary";
import { isOnNicheJob } from "../../../../lib/nicheScope";
import { jobMatchesAlertQuery } from "../../../../lib/categories";
import { alertPrefsLabel, isTwiceWeeklySendDay, jobMatchesAlertPrefs, parseAlertPrefs, serializeAlertPrefs } from "../../../../lib/alertPrefs";
import { renderAlertEmail, type DigestJob } from "../../../../lib/alerts/emailTemplate";
import { getPublicSiteUrl } from "../../../../lib/alerts/siteUrl";

export const runtime = "nodejs";
export const maxDuration = 60;

type AlertRow = {
  id: string;
  user_id: string | null;
  query: string | null;
  location: string | null;
  last_run_at: string | null;
};

type JobRow = {
  id: string;
  title: string | null;
  location: string | null;
  salary: string | null;
  remote_policy?: string | null;
  apply_url: string | null;
  keywords: string | null;
  tags: unknown;
  category: string | null;
  timestamp: number | null;
  companies?: { name?: string | null } | Array<{ name?: string | null }> | null;
};

const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
};

const getFromEmail = () => process.env.RESEND_FROM || "CareersPal <onboarding@resend.dev>";

const getCompanyName = (job: JobRow) => {
  if (Array.isArray(job.companies)) return job.companies[0]?.name || "Company";
  return job.companies?.name || "Company";
};

function isAuthorized(request: Request): boolean {
  const url = new URL(request.url);
  const secret = (url.searchParams.get("secret") || "").trim();
  const alerts = (process.env.ALERTS_CRON_SECRET || "").trim();
  const cron = (process.env.CRON_SECRET || "").trim();
  const auth = request.headers.get("authorization") || "";
  if (request.headers.get("x-vercel-cron") === "1") return true;
  if (cron && auth === `Bearer ${cron}`) return true;
  if (alerts && auth === `Bearer ${alerts}`) return true;
  if (alerts && secret === alerts) return true;
  if (cron && secret === cron) return true;
  return false;
}

function toDigestJobs(matches: JobRow[], baseUrl: string): DigestJob[] {
  return matches.slice(0, 10).map((job) => ({
    title: job.title || "Role",
    company: getCompanyName(job),
    location: job.location || "Remote",
    salary: formatSalaryDisplay(job.salary),
    href: `${baseUrl}/jobs/${createJobSlug({ title: job.title || "role", id: job.id })}?utm_source=alerts`,
  }));
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const force = url.searchParams.get("force") === "1";
  const now = new Date();
  if (!force && !isTwiceWeeklySendDay(now)) {
    return NextResponse.json({ ok: true, skipped: "not_send_day", dayUtc: now.getUTCDay() });
  }

  const resend = getResendClient();
  if (!resend) {
    return NextResponse.json({ error: "Resend not configured." }, { status: 500 });
  }

  const { data: alerts, error: alertsError } = await supabaseAdmin
    .from("alerts")
    .select("id,user_id,query,location,last_run_at")
    .order("created_at", { ascending: true });
  if (alertsError) {
    return NextResponse.json({ error: "Failed to load alerts." }, { status: 500 });
  }

  const sinceDefault = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
  const userIds = (alerts || []).map((alert) => alert.user_id).filter((id): id is string => Boolean(id));
  const { data: profiles } = userIds.length
    ? await supabaseAdmin.from("profiles").select("id,email").in("id", userIds)
    : { data: [] };

  const emailByUser = new Map((profiles || []).map((row) => [row.id, row.email]));
  const baseUrl = getPublicSiteUrl();
  const from = getFromEmail();

  const { data: recentJobs } = await supabaseAdmin
    .from("jobs")
    .select("id,title,location,salary,remote_policy,apply_url,keywords,tags,category,timestamp,companies(name)")
    .eq("status", "published")
    .gte("timestamp", sinceDefault.getTime());
  const published = ((recentJobs || []) as JobRow[]).filter((job) => isOnNicheJob(job));

  let sent = 0;
  const emailed = new Set<string>();
  let matchedTotal = 0;

  for (const alert of (alerts || []) as AlertRow[]) {
    if (!alert.user_id || !alert.query) continue;
    const toEmail = emailByUser.get(alert.user_id);
    if (!toEmail) continue;
    const since = alert.last_run_at ? new Date(alert.last_run_at).getTime() : sinceDefault.getTime();
    const matches = published.filter(
      (job) => (job.timestamp || 0) >= since && jobMatchesAlertQuery(job, alert.query || ""),
    );
    matchedTotal += matches.length;
    if (matches.length === 0) {
      if (!dryRun) await supabaseAdmin.from("alerts").update({ last_run_at: now.toISOString() }).eq("id", alert.id);
      continue;
    }
    if (!dryRun) {
      const digest = toDigestJobs(matches, baseUrl);
      const sendResult = await resend.emails.send({
        from,
        to: toEmail,
        subject: "New roles on CareersPal",
        html: renderAlertEmail({
          title: "New matching roles",
          preheader: "Published roles that match your alert.",
          introHtml: `<p style="margin:0 0 12px;">New published roles matching your saved categories. Each one opens on CareersPal.</p>`,
          jobs: digest,
          cta: { label: "Browse all jobs", href: `${baseUrl}/jobs` },
          unsubscribeUrl: `${baseUrl}/account?tab=alerts`,
          footerNote: "Two emails a week. Change or stop this in your account.",
        }),
      });
      if (!sendResult.error) {
        sent += 1;
        emailed.add(toEmail.toLowerCase());
      }
      await supabaseAdmin.from("alerts").update({ last_run_at: now.toISOString() }).eq("id", alert.id);
    }
  }

  const { data: subscribers } = await supabaseAdmin.from("subscribers").select("email,preference");
  let subscriberSent = 0;
  for (const sub of subscribers || []) {
    const toEmail = String(sub.email || "").trim().toLowerCase();
    if (!toEmail || emailed.has(toEmail)) continue;
    const prefs = parseAlertPrefs(sub.preference);
    const since = prefs.lastSentAt ? new Date(prefs.lastSentAt).getTime() : sinceDefault.getTime();
    const matches = published.filter((job) => (job.timestamp || 0) >= since && jobMatchesAlertPrefs(job, prefs));
    matchedTotal += matches.length;
    if (matches.length === 0) {
      if (!dryRun) {
        await supabaseAdmin
          .from("subscribers")
          .update({ preference: serializeAlertPrefs({ ...prefs, lastSentAt: now.toISOString() }) })
          .eq("email", toEmail);
      }
      continue;
    }
    if (dryRun) continue;
    const digest = toDigestJobs(matches, baseUrl);
    const unsub = `${baseUrl}/api/alerts/unsubscribe?token=${encodeURIComponent(prefs.token)}`;
    const sendResult = await resend.emails.send({
      from,
      to: toEmail,
      subject: "New roles on CareersPal",
      headers: {
        "List-Unsubscribe": `<${unsub}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      html: renderAlertEmail({
        title: "New matching roles",
        preheader: "Published roles that match your alert.",
        introHtml: `<p style="margin:0 0 12px;">Matching your alert: ${alertPrefsLabel(prefs)}. Each role opens on CareersPal first.</p>`,
        jobs: digest,
        cta: { label: "Browse all jobs", href: `${baseUrl}/jobs` },
        unsubscribeUrl: unsub,
      }),
    });
    if (!sendResult.error) {
      subscriberSent += 1;
      emailed.add(toEmail);
    }
    await supabaseAdmin
      .from("subscribers")
      .update({ preference: serializeAlertPrefs({ ...prefs, lastSentAt: now.toISOString() }) })
      .eq("email", toEmail);
  }

  await supabaseAdmin.from("audit_logs").insert({
    action: dryRun ? "alerts_twice_weekly_dry_run" : "alerts_twice_weekly_sent",
    metadata: { sent, subscriberSent, matchedTotal, dryRun, force },
  });

  return NextResponse.json({ ok: true, sent, subscriberSent, dryRun, matchedTotal, force });
}
