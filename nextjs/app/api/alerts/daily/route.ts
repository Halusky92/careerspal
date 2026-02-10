import { NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { createJobSlug } from "../../../../lib/jobs";

export const runtime = "nodejs";

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

const getFromEmail = () => {
  return process.env.RESEND_FROM || "CareersPal <onboarding@resend.dev>";
};

const getBaseUrl = () => {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) return siteUrl.replace(/\/+$/, "");
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;
  return "http://localhost:3000";
};

const normalize = (value?: string | null) => (value || "").toLowerCase().trim();

const splitQuery = (query: string) => {
  const parts = query.split("@");
  if (parts.length < 2) {
    return { search: query.trim(), location: "" };
  }
  return { search: parts[0].trim(), location: parts.slice(1).join("@").trim() };
};

const getTags = (tags: unknown) => {
  if (Array.isArray(tags)) return tags.map((t) => String(t));
  return [];
};

const matchesAlert = (job: JobRow, query: string) => {
  const { search, location } = splitQuery(query);
  const searchNeedle = normalize(search);
  const locationNeedle = normalize(location);
  const companyName = Array.isArray(job.companies)
    ? job.companies[0]?.name || ""
    : job.companies?.name || "";
  const tags = getTags(job.tags);

  const haystack = normalize(
    [
      job.title,
      companyName,
      job.category,
      job.keywords,
      job.location,
      ...tags,
    ]
      .filter(Boolean)
      .join(" "),
  );

  const matchesSearch = !searchNeedle || haystack.includes(searchNeedle);
  const matchesLocation = !locationNeedle || normalize(job.location).includes(locationNeedle);
  return matchesSearch && matchesLocation;
};

export async function GET(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  const dryRun = url.searchParams.get("dryRun") === "1";
  if (process.env.ALERTS_CRON_SECRET && secret !== process.env.ALERTS_CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const now = new Date();
  const sinceDefault = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id,email")
    .in(
      "id",
      (alerts || [])
        .map((alert) => alert.user_id)
        .filter((id): id is string => Boolean(id)),
    );

  const emailByUser = new Map((profiles || []).map((row) => [row.id, row.email]));
  const baseUrl = getBaseUrl();
  const from = getFromEmail();

  let sent = 0;
  const attempted: Array<{ alertId: string; email: string; matches: number }> = [];
  for (const alert of (alerts || []) as AlertRow[]) {
    if (!alert.user_id || !alert.query) continue;
    const toEmail = emailByUser.get(alert.user_id);
    if (!toEmail) continue;

    const since = alert.last_run_at ? new Date(alert.last_run_at) : sinceDefault;
    const sinceMs = since.getTime();

    const { data: jobs } = await supabaseAdmin
      .from("jobs")
      .select("id,title,location,salary,apply_url,keywords,tags,category,timestamp,companies(name)")
      .eq("status", "published")
      .gte("timestamp", sinceMs);

    const matches = (jobs || []).filter((job) => matchesAlert(job as JobRow, alert.query || ""));

    if (matches.length > 0 && !dryRun) {
      const rows = matches
        .slice(0, 10)
        .map((job) => {
          const companyName = Array.isArray(job.companies)
            ? job.companies[0]?.name || "Company"
            : job.companies?.name || "Company";
          const jobUrl = `${baseUrl}/jobs/${createJobSlug({ title: job.title || "role", id: job.id })}`;
          return `
            <li>
              <strong>${job.title || "Role"}</strong> at ${companyName}<br/>
              ${job.location || "Remote"} · ${job.salary || "Salary not listed"}<br/>
              <a href="${jobUrl}">${jobUrl}</a>
            </li>
          `;
        })
        .join("");

      await resend.emails.send({
        from,
        to: toEmail,
        subject: `Daily job alert: ${alert.query}`,
        html: `
          <p>Here are new roles matching your alert:</p>
          <ul>${rows}</ul>
          <p>Manage your alerts in your dashboard.</p>
        `,
      });
      sent += 1;
    }

    attempted.push({ alertId: alert.id, email: toEmail, matches: matches.length });

    await supabaseAdmin
      .from("alerts")
      .update({ last_run_at: now.toISOString() })
      .eq("id", alert.id);
  }

  await supabaseAdmin.from("audit_logs").insert({
    action: dryRun ? "alerts_daily_dry_run" : "alerts_daily_sent",
    metadata: {
      totalAlerts: (alerts || []).length,
      sent,
      attempted,
      dryRun,
    },
  });

  return NextResponse.json({ sent, dryRun });
}
