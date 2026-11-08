import { Resend } from "resend";
import { supabaseAdmin } from "../supabaseAdmin";
import { createJobSlug } from "../jobs";
import { formatSalaryDisplay } from "../formatSalary";
import { isOnNicheJob } from "../nicheScope";
import { jobMatchesAlertQuery } from "../categories";
import {
  alertPrefsLabel,
  isGuestAlertConfirmed,
  jobMatchesAlertPrefs,
  parseAlertPrefs,
  serializeAlertPrefs,
} from "../alertPrefs";
import { renderAlertEmail, type DigestJob } from "./emailTemplate";
import { getPublicSiteUrl } from "./siteUrl";
import { getResendFrom } from "../resendFrom";
import { ownerAdminEmails } from "../adminAccess";
import { jobsForDigest } from "./digestJobs";

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
  description?: string | null;
  remote_policy?: string | null;
  apply_url: string | null;
  keywords: string | null;
  tags: unknown;
  category: string | null;
  timestamp: number | null;
  companies?: { name?: string | null } | Array<{ name?: string | null }> | null;
};

export type SendDigestOptions = {
  dryRun?: boolean;
  force?: boolean;
  trial?: boolean;
};

const getCompanyName = (job: JobRow) => {
  if (Array.isArray(job.companies)) return job.companies[0]?.name || "Company";
  return job.companies?.name || "Company";
};

function toDigestJobs(matches: JobRow[], baseUrl: string): DigestJob[] {
  return matches.slice(0, 10).map((job) => ({
    title: job.title || "Role",
    company: getCompanyName(job),
    location: job.location || "—",
    salary: formatSalaryDisplay(job.salary, job.description),
    href: `${baseUrl}/jobs/${createJobSlug({ title: job.title || "role", id: job.id })}?utm_source=alerts`,
  }));
}

export async function sendDigest(options: SendDigestOptions = {}) {
  const dryRun = Boolean(options.dryRun);
  const trial = Boolean(options.trial);
  const force = Boolean(options.force) || trial;
  if (!supabaseAdmin) {
    return { ok: false as const, error: "Supabase not configured." };
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false as const, error: "Resend not configured." };
  }
  const resend = new Resend(apiKey);
  const now = new Date();
  const sinceDefault = new Date(now.getTime() - (trial ? 30 : 4) * 24 * 60 * 60 * 1000);
  const baseUrl = getPublicSiteUrl();
  const from = getResendFrom();

  const { data: alerts, error: alertsError } = await supabaseAdmin
    .from("alerts")
    .select("id,user_id,query,location,last_run_at")
    .order("created_at", { ascending: true });
  if (alertsError) {
    return { ok: false as const, error: "Failed to load alerts." };
  }

  const userIds = (alerts || []).map((alert) => alert.user_id).filter((id): id is string => Boolean(id));
  const { data: alertProfiles } = userIds.length
    ? await supabaseAdmin.from("profiles").select("id,email").in("id", userIds)
    : { data: [] };
  const emailByUser = new Map((alertProfiles || []).map((row) => [row.id, row.email]));

  let jobQuery = supabaseAdmin
    .from("jobs")
    .select("id,title,description,location,salary,remote_policy,apply_url,keywords,tags,category,timestamp,companies(name)")
    .eq("status", "published")
    .order("timestamp", { ascending: false })
    .limit(trial ? 40 : 80);
  if (!trial) jobQuery = jobQuery.gte("timestamp", sinceDefault.getTime());
  const { data: recentJobs } = await jobQuery;
  const published = ((recentJobs || []) as JobRow[]).filter((job) => isOnNicheJob(job));
  const liveFallback = published.slice(0, 8);

  let sent = 0;
  const emailed = new Set<string>();
  let matchedTotal = 0;
  const recipients: string[] = [];

  for (const alert of (alerts || []) as AlertRow[]) {
    if (!alert.user_id || !alert.query) continue;
    const toEmail = String(emailByUser.get(alert.user_id) || "").trim().toLowerCase();
    if (!toEmail || emailed.has(toEmail)) continue;
    const since = trial ? 0 : alert.last_run_at ? new Date(alert.last_run_at).getTime() : sinceDefault.getTime();
    const matched = published.filter(
      (job) => (job.timestamp || 0) >= since && jobMatchesAlertQuery(job, alert.query || ""),
    );
    const bundle = jobsForDigest(matched, liveFallback, trial);
    matchedTotal += matched.length;
    if (bundle.length === 0) {
      if (!dryRun) await supabaseAdmin.from("alerts").update({ last_run_at: now.toISOString() }).eq("id", alert.id);
      continue;
    }
    if (!dryRun) {
      const sendResult = await resend.emails.send({
        from,
        to: toEmail,
        subject: trial ? "Live roles on CareersPal" : "New roles on CareersPal",
        html: renderAlertEmail({
          title: trial ? "Roles on the board" : "New matching roles",
          preheader: "Published Ops and Systems roles from CareersPal.",
          introHtml: `<p style="margin:0 0 12px;">${trial ? "A short look at live roles on CareersPal." : "New published roles matching your saved categories."} Each one opens on CareersPal.</p>`,
          jobs: toDigestJobs(bundle, baseUrl),
          cta: { label: "Browse all jobs", href: `${baseUrl}/jobs` },
          unsubscribeUrl: `${baseUrl}/account?tab=alerts`,
          footerNote: "Two emails a week. Change or stop this in your account.",
        }),
      });
      if (!sendResult.error) {
        sent += 1;
        emailed.add(toEmail);
        recipients.push(toEmail);
      }
      await supabaseAdmin.from("alerts").update({ last_run_at: now.toISOString() }).eq("id", alert.id);
    } else {
      recipients.push(toEmail);
    }
  }

  const { data: subscribers } = await supabaseAdmin.from("subscribers").select("email,preference");
  let subscriberSent = 0;
  let skippedUnconfirmed = 0;
  for (const sub of subscribers || []) {
    const toEmail = String(sub.email || "").trim().toLowerCase();
    if (!toEmail || emailed.has(toEmail)) continue;
    const prefs = parseAlertPrefs(sub.preference);
    if (!isGuestAlertConfirmed(prefs)) {
      skippedUnconfirmed += 1;
      continue;
    }
    const since = trial ? 0 : prefs.lastSentAt ? new Date(prefs.lastSentAt).getTime() : sinceDefault.getTime();
    const matched = published.filter((job) => (job.timestamp || 0) >= since && jobMatchesAlertPrefs(job, prefs));
    const bundle = jobsForDigest(matched, liveFallback, trial);
    matchedTotal += matched.length;
    if (bundle.length === 0) {
      if (!dryRun) {
        await supabaseAdmin
          .from("subscribers")
          .update({ preference: serializeAlertPrefs({ ...prefs, lastSentAt: now.toISOString() }) })
          .eq("email", toEmail);
      }
      continue;
    }
    if (dryRun) {
      recipients.push(toEmail);
      continue;
    }
    const unsub = `${baseUrl}/api/alerts/unsubscribe?token=${encodeURIComponent(prefs.token)}`;
    const sendResult = await resend.emails.send({
      from,
      to: toEmail,
      subject: trial ? "Live roles on CareersPal" : "New roles on CareersPal",
      headers: {
        "List-Unsubscribe": `<${unsub}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      html: renderAlertEmail({
        title: trial ? "Roles on the board" : "New matching roles",
        preheader: "Published Ops and Systems roles from CareersPal.",
        introHtml: `<p style="margin:0 0 12px;">${trial ? "A short look at live roles matching" : "Matching"} your alert: ${alertPrefsLabel(prefs)}. Each role opens on CareersPal first.</p>`,
        jobs: toDigestJobs(bundle, baseUrl),
        cta: { label: "Browse all jobs", href: `${baseUrl}/jobs` },
        unsubscribeUrl: unsub,
      }),
    });
    if (!sendResult.error) {
      subscriberSent += 1;
      emailed.add(toEmail);
      recipients.push(toEmail);
    }
    await supabaseAdmin
      .from("subscribers")
      .update({ preference: serializeAlertPrefs({ ...prefs, lastSentAt: now.toISOString() }) })
      .eq("email", toEmail);
  }

  if (trial) {
    const { data: candidates } = await supabaseAdmin.from("profiles").select("email,role");
    for (const row of candidates || []) {
      const toEmail = String(row.email || "").trim().toLowerCase();
      const role = String(row.role || "");
      if (!toEmail || emailed.has(toEmail)) continue;
      if (role !== "candidate" && !ownerAdminEmails().includes(toEmail)) continue;
      if (liveFallback.length === 0) continue;
      if (dryRun) {
        recipients.push(toEmail);
        continue;
      }
      const sendResult = await resend.emails.send({
        from,
        to: toEmail,
        subject: "Live roles on CareersPal",
        html: renderAlertEmail({
          title: "Roles on the board",
          preheader: "A short look at live Ops and Systems roles.",
          introHtml: `<p style="margin:0 0 12px;">You have a CareersPal account, so here is a sample of live roles. Set alerts if you want this regularly.</p>`,
          jobs: toDigestJobs(liveFallback, baseUrl),
          cta: { label: "Browse all jobs", href: `${baseUrl}/jobs` },
          unsubscribeUrl: `${baseUrl}/account?tab=alerts`,
          footerNote: "This was a one-time sample. Weekly alerts only go out if you subscribe.",
        }),
      });
      if (!sendResult.error) {
        sent += 1;
        emailed.add(toEmail);
        recipients.push(toEmail);
      }
    }
  }

  await supabaseAdmin.from("audit_logs").insert({
    action: dryRun ? "alerts_digest_dry_run" : trial ? "alerts_trial_sent" : "alerts_twice_weekly_sent",
    metadata: { sent, subscriberSent, matchedTotal, skippedUnconfirmed, dryRun, force, trial, recipients: recipients.slice(0, 40) },
  });

  return {
    ok: true as const,
    sent,
    subscriberSent,
    dryRun,
    matchedTotal,
    skippedUnconfirmed,
    force,
    trial,
    recipients: recipients.slice(0, 40),
    jobs: liveFallback.length,
  };
}
