import { Resend } from "resend";
import { supabaseAdmin } from "./supabaseAdmin";
import { getResendFrom } from "./resendFrom";
import { createJobSlug } from "./jobs";

const getBaseUrl = () => {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) return siteUrl.replace(/\/+$/, "");
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;
  return "http://localhost:3000";
};

const escapeHtml = (value?: string | null) =>
  (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const wrap = (title: string, body: string, href: string, label: string) => `
    <div style="font-family:Inter,Segoe UI,Arial,sans-serif;color:#111827;">
      <h1 style="font-size:20px;">${escapeHtml(title)}</h1>
      ${body}
      <p><a href="${href}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;">${escapeHtml(label)}</a></p>
    </div>`;

export async function sendAdminPendingDigest(input: {
  listings: Array<{
    id: string;
    title: string;
    company: string;
    salary?: string | null;
    location?: string | null;
    applyUrl?: string | null;
  }>;
  extraTo?: string[];
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || input.listings.length === 0) return;
  const resend = new Resend(apiKey);
  const from = getResendFrom();
  const supportEmail = "info@careerspal.com";
  const adminTo = new Set(
    [
      ...(process.env.ADMIN_NOTIFICATION_EMAIL || supportEmail).split(","),
      "mb.bilek@gmail.com",
      ...(input.extraTo || []),
    ]
      .map((email) => email.trim())
      .filter(Boolean),
  );
  const baseUrl = getBaseUrl();
  const adminUrl = `${baseUrl}/dashboard/admin?tab=review`;
  const rows = input.listings
    .map(
      (item) =>
        `<tr>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.title)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.company)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.salary || "—")}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.location || "—")}</td>
        </tr>`,
    )
    .join("");
  try {
    await resend.emails.send({
      from,
      to: [...adminTo],
      subject: `${input.listings.length} listings waiting for confirm`,
      html: wrap(
        "Waiting for confirm",
        `<p>Invented company listings are in the queue. Green ✓ publishes. Red ✕ deletes.</p>
         <table style="border-collapse:collapse;width:100%;font-size:14px;">
           <thead><tr>
             <th style="text-align:left;padding:8px 10px;">Title</th>
             <th style="text-align:left;padding:8px 10px;">Company</th>
             <th style="text-align:left;padding:8px 10px;">Salary</th>
             <th style="text-align:left;padding:8px 10px;">Location</th>
           </tr></thead>
           <tbody>${rows}</tbody>
         </table>`,
        adminUrl,
        "Open confirm desk",
      ),
    });
  } catch (error) {
    await supabaseAdmin?.from("audit_logs").insert({
      action: "email_failed",
      metadata: { error: String(error), kind: "pending_digest" },
    });
    throw error;
  }
}

export async function sendListingOutcomeEmails(input: {
  jobId: string;
  title?: string | null;
  companyName?: string | null;
  planType?: string | null;
  planPrice?: number | null;
  buyerEmail?: string | null;
  startPack?: boolean;
  live: boolean;
  paid?: boolean;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const resend = new Resend(apiKey);
  const from = getResendFrom();
  const supportEmail = "info@careerspal.com";
  const adminTo = (process.env.ADMIN_NOTIFICATION_EMAIL || supportEmail)
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
  const jobLine = `${input.title || "Listing"}${input.companyName ? ` at ${input.companyName}` : ""}`;
  const planLine = input.startPack
    ? "Start pack ($0)"
    : `${input.planType || "Standard"}${typeof input.planPrice === "number" ? ` ($${input.planPrice})` : ""}`;
  const baseUrl = getBaseUrl();
  const jobUrl = `${baseUrl}/jobs/${createJobSlug({ id: input.jobId, title: input.title || "role" })}`;
  const employerUrl = `${baseUrl}/dashboard/employer`;
  const adminUrl = input.live ? `${baseUrl}/dashboard/admin?tab=jobs` : `${baseUrl}/dashboard/admin?tab=review`;

  const buyerLive = input.startPack
    ? "Your Start pack listing is live"
    : "Payment received — listing is live";
  const buyerPending = input.startPack
    ? "Your listing is in review"
    : "Payment received — listing is in review";
  const adminLive = input.startPack ? "Start pack listing is live ($0)" : "Paid listing is live";
  const adminPending = input.startPack ? "Start pack listing waiting for confirm" : "Paid listing waiting for confirm";

  try {
    if (input.buyerEmail) {
      await resend.emails.send({
        from,
        to: input.buyerEmail,
        subject: input.live ? buyerLive : buyerPending,
        html: wrap(
          input.live ? "Your listing is live" : "Submitted for review",
          `<p><strong>${escapeHtml(jobLine)}</strong></p>
           <p>Plan: ${escapeHtml(planLine)}</p>
           <p>${
             input.live
               ? "It is on the CareersPal board now."
               : "It will go live after a last check. That is not a timed SLA."
           }</p>`,
          input.live ? jobUrl : employerUrl,
          input.live ? "View listing" : "Open employer dashboard",
        ),
      });
    }
    await resend.emails.send({
      from,
      to: adminTo,
      subject: input.live ? adminLive : adminPending,
      html: wrap(
        input.live ? "Listing is live" : "Review required",
        `<p>${escapeHtml(jobLine)}</p>
         <p>Plan: ${escapeHtml(planLine)}</p>
         <p>Buyer: ${escapeHtml(input.buyerEmail || "Unknown")}</p>
         <p>${input.live ? "Already on the board. FYI only." : "Open Confirm jobs and use ✓ or ✕."}</p>`,
        input.live ? jobUrl : adminUrl,
        input.live ? "View on board" : "Confirm listing",
      ),
    });
  } catch (error) {
    await supabaseAdmin?.from("audit_logs").insert({
      action: "email_failed",
      job_id: input.jobId,
      metadata: { error: String(error), live: input.live, startPack: Boolean(input.startPack) },
    });
  }
}

/** @deprecated use sendListingOutcomeEmails */
export async function sendListingReviewEmails(input: {
  jobId: string;
  title?: string | null;
  companyName?: string | null;
  planType?: string | null;
  planPrice?: number | null;
  buyerEmail?: string | null;
  startPack?: boolean;
  confirmForBuyer?: boolean;
}) {
  await sendListingOutcomeEmails({
    ...input,
    live: false,
    paid: !input.startPack,
  });
}

export async function maybeNotifyStartPackTwoLeft(input: {
  profileId: string;
  email?: string | null;
  remainingAfter: number;
  usedAfter: number;
  quota: number;
  nextPrice: number;
  jobId?: string | null;
}) {
  if (input.remainingAfter !== 2) return;
  if (!input.email || !supabaseAdmin) return;

  const { data: existing } = await supabaseAdmin
    .from("audit_logs")
    .select("id")
    .eq("actor_id", input.profileId)
    .eq("action", "start_pack_two_left")
    .limit(1);
  if (existing && existing.length > 0) return;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const resend = new Resend(apiKey);
  const from = getResendFrom();
  const baseUrl = getBaseUrl();

  try {
    await resend.emails.send({
      from,
      to: input.email,
      subject: "2 Start pack listings left — then $79",
      html: wrapLocal(
        "2 free listings left",
        `<p>You have <strong>2 free Standard listings</strong> left on the Start pack.</p>
         <p>Used: ${input.usedAfter} of ${input.quota}. After those 2, the next listing is Standard <strong>$${input.nextPrice}</strong> / 30 days.</p>
         <p>A listing only counts after it goes live.</p>`,
        `${baseUrl}/post-a-job`,
        "Post the next role",
      ),
    });
    await supabaseAdmin.from("audit_logs").insert({
      action: "start_pack_two_left",
      actor_id: input.profileId,
      job_id: input.jobId || null,
      metadata: { remainingAfter: 2, usedAfter: input.usedAfter, quota: input.quota },
    });
  } catch (error) {
    await supabaseAdmin.from("audit_logs").insert({
      action: "email_failed",
      actor_id: input.profileId,
      job_id: input.jobId || null,
      metadata: { error: String(error), kind: "start_pack_two_left" },
    });
  }
}

const wrapLocal = (title: string, body: string, href: string, label: string) => `
    <div style="font-family:Inter,Segoe UI,Arial,sans-serif;color:#111827;">
      <h1 style="font-size:20px;">${title}</h1>
      ${body}
      <p><a href="${href}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;">${label}</a></p>
    </div>`;
