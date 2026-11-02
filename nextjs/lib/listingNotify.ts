import { Resend } from "resend";
import { supabaseAdmin } from "./supabaseAdmin";

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
  const from = process.env.RESEND_FROM || "CareersPal <onboarding@resend.dev>";
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
