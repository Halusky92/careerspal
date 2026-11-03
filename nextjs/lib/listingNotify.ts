import { Resend } from "resend";
import { supabaseAdmin } from "./supabaseAdmin";
import { getResendFrom } from "./resendFrom";

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

export async function sendListingReviewEmails(input: {
  jobId: string;
  title?: string | null;
  companyName?: string | null;
  planType?: string | null;
  planPrice?: number | null;
  buyerEmail?: string | null;
  startPack?: boolean;
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
  const subjectBuyer = input.startPack
    ? "Start pack listing received — under review"
    : "Payment confirmed — your job listing is under review";
  const subjectAdmin = input.startPack
    ? "New Start pack listing — review required"
    : "New paid job received — review required";

  const wrap = (title: string, body: string, href: string, label: string) => `
    <div style="font-family:Inter,Segoe UI,Arial,sans-serif;color:#111827;">
      <h1 style="font-size:20px;">${escapeHtml(title)}</h1>
      ${body}
      <p><a href="${href}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;">${escapeHtml(label)}</a></p>
    </div>`;

  try {
    if (input.buyerEmail) {
      await resend.emails.send({
        from,
        to: input.buyerEmail,
        subject: subjectBuyer,
        html: wrap(
          input.startPack ? "Listing received" : "Payment confirmed",
          `<p>We’ve received <strong>${escapeHtml(jobLine)}</strong>.</p><p>Plan: ${escapeHtml(planLine)}</p><p>It will go live after review. That is not a timed SLA.</p>`,
          `${baseUrl}/dashboard/employer`,
          "Open employer dashboard",
        ),
      });
    }
    await resend.emails.send({
      from,
      to: adminTo,
      subject: subjectAdmin,
      html: wrap(
        "Review required",
        `<p>${escapeHtml(jobLine)}</p><p>Plan: ${escapeHtml(planLine)}</p><p>Buyer: ${escapeHtml(input.buyerEmail || "Unknown")}</p>`,
        `${baseUrl}/dashboard/admin`,
        "Review in admin dashboard",
      ),
    });
  } catch (error) {
    await supabaseAdmin?.from("audit_logs").insert({
      action: "email_failed",
      job_id: input.jobId,
      metadata: { error: String(error), startPack: Boolean(input.startPack) },
    });
  }
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
         <p>Reviewed before publish. No response SLA.</p>`,
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
