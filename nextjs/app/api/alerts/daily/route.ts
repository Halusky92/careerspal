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

const escapeHtml = (value?: string | null) =>
  (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

type EmailCta = {
  label: string;
  href: string;
};

type EmailLayoutProps = {
  title: string;
  preheader: string;
  body: string;
  cta?: EmailCta;
  footerNote?: string;
};

const renderEmail = ({ title, preheader, body, cta, footerNote }: EmailLayoutProps) => `
  <!doctype html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(title)}</title>
    </head>
    <body style="margin:0;padding:0;background:#f6f7fb;font-family:Inter,Segoe UI,Arial,sans-serif;">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
        ${escapeHtml(preheader)}
      </div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7fb;">
        <tr>
          <td align="center" style="padding:32px 16px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:16px;box-shadow:0 12px 30px rgba(15,23,42,0.08);overflow:hidden;">
              <tr>
                <td style="padding:32px 32px 12px;">
                  <div style="font-size:12px;letter-spacing:1.2px;text-transform:uppercase;color:#7b7f8c;">
                    CareersPal
                  </div>
                  <h1 style="margin:12px 0 0;font-size:24px;line-height:1.3;color:#111827;">
                    ${escapeHtml(title)}
                  </h1>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 32px 0;font-size:15px;line-height:1.6;color:#111827;">
                  ${body}
                </td>
              </tr>
              <tr>
                <td style="padding:24px 32px 32px;">
                  ${
                    cta
                      ? `<a href="${cta.href}" style="display:inline-block;background:#6d28d9;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600;">${escapeHtml(
                          cta.label,
                        )}</a>`
                      : ""
                  }
                </td>
              </tr>
              <tr>
                <td style="padding:16px 32px 28px;border-top:1px solid #eef0f5;font-size:12px;color:#6b7280;">
                  ${escapeHtml(footerNote || "You are receiving this email from CareersPal.")}
                </td>
              </tr>
            </table>
            <div style="max-width:640px;margin-top:12px;font-size:12px;color:#9ca3af;">
              CareersPal · Daily alerts for your saved searches
            </div>
          </td>
        </tr>
      </table>
    </body>
  </html>
`;

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

const getCompanyName = (job: JobRow) => {
  if (Array.isArray(job.companies)) {
    return job.companies[0]?.name || "Company";
  }
  return job.companies?.name || "Company";
};

const matchesAlert = (job: JobRow, query: string) => {
  const { search, location } = splitQuery(query);
  const searchNeedle = normalize(search);
  const locationNeedle = normalize(location);
  const companyName = getCompanyName(job);
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

    const jobRows = (jobs || []) as JobRow[];
    const matches = jobRows.filter((job) => matchesAlert(job, alert.query || ""));

    if (matches.length > 0 && !dryRun) {
      const rows = matches
        .slice(0, 10)
        .map((job) => {
          const companyName = getCompanyName(job);
          const jobUrl = `${baseUrl}/jobs/${createJobSlug({ title: job.title || "role", id: job.id })}`;
        const safeTitle = escapeHtml(job.title || "Role");
        const safeCompany = escapeHtml(companyName);
        const safeLocation = escapeHtml(job.location || "Remote");
        const safeSalary = escapeHtml(job.salary || "Salary not listed");
          return `
            <tr>
              <td style="padding:16px;border:1px solid #eef0f5;border-radius:12px;background:#fbfbff;">
                <div style="font-weight:600;color:#111827;margin-bottom:4px;">${safeTitle}</div>
                <div style="color:#6b7280;font-size:13px;margin-bottom:6px;">
                  ${safeCompany} · ${safeLocation}
                </div>
                <div style="color:#6b7280;font-size:13px;margin-bottom:10px;">${safeSalary}</div>
                <a href="${jobUrl}" style="display:inline-block;background:#6d28d9;color:#ffffff;text-decoration:none;padding:8px 12px;border-radius:8px;font-size:13px;font-weight:600;">
                  View role
                </a>
              </td>
            </tr>
            <tr><td style="height:12px;"></td></tr>
          `;
        })
        .join("");

      await resend.emails.send({
        from,
        to: toEmail,
        subject: `Daily job alert: ${alert.query}`,
        html: renderEmail({
          title: "Your daily job alert",
          preheader: "New roles matching your saved search.",
          body: `
            <p style="margin:0 0 12px;">Here are new roles matching your alert:</p>
            <div style="background:#f8f9ff;border:1px solid #eef0ff;border-radius:12px;padding:12px 16px;margin:0 0 18px;font-size:14px;color:#374151;">
              <strong>Alert:</strong> ${escapeHtml(alert.query)}
            </div>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;">
              ${rows}
            </table>
            <p style="margin:12px 0 0;">Manage your alerts in your dashboard.</p>
          `,
          cta: { label: "Open candidate dashboard", href: `${baseUrl}/dashboard/candidate` },
          footerNote: "You are receiving this email because you enabled job alerts.",
        }),
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
