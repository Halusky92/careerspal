import { NextResponse } from "next/server";
import Stripe from "stripe";
import { Resend } from "resend";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

type StripeEmailJobRow = {
  id: string;
  title: string;
  plan_type: string | null;
  plan_price: number | null;
  companies?: { name?: string | null } | Array<{ name?: string | null }> | null;
};

export const runtime = "nodejs";

const getBaseUrl = () => {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) return siteUrl.replace(/\/+$/, "");
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;
  return "http://localhost:3000";
};

const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
};

const getFromEmail = () => {
  return process.env.RESEND_FROM || "CareersPal <onboarding@resend.dev>";
};

const getAdminEmails = () => {
  const raw = process.env.ADMIN_NOTIFICATION_EMAIL || "info@careerspal.com";
  return raw
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
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
              CareersPal · Premium job listings for ambitious teams
            </div>
          </td>
        </tr>
      </table>
    </body>
  </html>
`;

const logEmailIssue = async (jobId: string, context: Record<string, unknown>) => {
  try {
    await supabaseAdmin?.from("audit_logs").insert({
      action: "email_failed",
      job_id: jobId,
      metadata: context,
    });
  } catch {
    // avoid failing webhook on audit log issues
  }
};

export async function POST(request: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKey) {
    return NextResponse.json(
      { error: "Missing STRIPE_SECRET_KEY (required for Stripe SDK initialization)." },
      { status: 500 },
    );
  }
  if (!webhookSecret) {
    return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET." }, { status: 500 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Supabase admin not configured. Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 },
    );
  }

  try {
    const stripe = new Stripe(stripeKey, { apiVersion: "2026-01-28.clover" });
    const signature = request.headers.get("stripe-signature");
    const payload = await request.text();

    if (!signature) {
      return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid signature.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const jobId = session.metadata?.jobId;
      if (jobId) {
        const isPaid = session.payment_status === "paid";
        await supabaseAdmin
          .from("jobs")
          .update({
            status: isPaid ? "pending_review" : "draft",
            stripe_payment_status: session.payment_status || (isPaid ? "paid" : "unpaid"),
            stripe_session_id: session.id,
            posted_at_text: isPaid ? "Just now" : undefined,
            timestamp: isPaid ? Date.now() : undefined,
          })
          .eq("id", jobId);
        await supabaseAdmin.from("audit_logs").insert({
          action: isPaid ? "payment_received" : "payment_incomplete",
          job_id: jobId,
          metadata: {
            stripeSessionId: session.id,
            amountTotal: session.amount_total,
            currency: session.currency,
            paymentStatus: session.payment_status,
          },
        });

        if (isPaid) {
          const baseUrl = getBaseUrl();
          const resend = getResendClient();
          if (resend) {
            const { data: job } = await supabaseAdmin
              .from("jobs")
              .select("id,title,plan_type,plan_price,companies(name)")
              .eq("id", jobId)
              .single();
            const jobRow = (job ?? null) as StripeEmailJobRow | null;
            const companyName = Array.isArray(jobRow?.companies) ? jobRow?.companies[0]?.name : jobRow?.companies?.name;
            const buyerEmail = session.customer_details?.email || session.customer_email;
            const from = getFromEmail();
            const jobLine = jobRow ? `${jobRow.title}${companyName ? ` at ${companyName}` : ""}` : "your job listing";
            const planLine = jobRow?.plan_type
              ? `${jobRow.plan_type}${jobRow.plan_price ? ` ($${jobRow.plan_price})` : ""}`
              : "Standard";
            const dashboardUrl = `${baseUrl}/dashboard/employer`;
            const adminDashboardUrl = `${baseUrl}/dashboard/admin`;
            const supportEmail = "info@careerspal.com";
            const safeJobLine = escapeHtml(jobLine);
            const safePlanLine = escapeHtml(planLine);
            const safeBuyerEmail = escapeHtml(buyerEmail ?? "Unknown");
            const safeSupportEmail = escapeHtml(supportEmail);

            try {
              if (buyerEmail) {
                const buyerResult = await resend.emails.send({
                  from,
                  to: buyerEmail,
                  subject: "Payment confirmed — your job listing is under review",
                  html: renderEmail({
                    title: "Payment confirmed",
                    preheader: "Your listing is under review and will go live after approval.",
                    body: `
                      <p style="margin:0 0 12px;">Hi there,</p>
                      <p style="margin:0 0 16px;">Your payment was confirmed and we’ve received your job listing.</p>
                      <div style="background:#f8f9ff;border:1px solid #eef0ff;border-radius:12px;padding:16px;margin:0 0 18px;">
                        <div style="font-weight:600;color:#111827;margin-bottom:6px;">Listing details</div>
                        <div style="color:#374151;font-size:14px;line-height:1.6;">
                          <div><strong>Listing:</strong> ${safeJobLine}</div>
                          <div><strong>Plan:</strong> ${safePlanLine}</div>
                        </div>
                      </div>
                      <p style="margin:0 0 12px;">Your listing is now under review and will go live after approval.</p>
                      <p style="margin:0 0 16px;">Track status and edit your listing anytime.</p>
                      <p style="margin:0;">Need help? Reply to this email or contact <a href="mailto:${supportEmail}" style="color:#6d28d9;text-decoration:none;">${safeSupportEmail}</a>.</p>
                    `,
                    cta: { label: "Open employer dashboard", href: dashboardUrl },
                    footerNote: `Questions? Contact ${supportEmail}`,
                  }),
                });
                if (buyerResult?.error) {
                  console.error("Resend buyer email failed:", buyerResult.error);
                  await logEmailIssue(jobId, { type: "buyer", error: buyerResult.error });
                }
              }

              const adminResult = await resend.emails.send({
                from,
                to: getAdminEmails(),
                subject: "New paid job received — review required",
                html: renderEmail({
                  title: "New paid job received",
                  preheader: "Review required before publishing.",
                  body: `
                    <p style="margin:0 0 12px;">A new job has been paid and is waiting for review.</p>
                    <div style="background:#f8f9ff;border:1px solid #eef0ff;border-radius:12px;padding:16px;margin:0 0 18px;">
                      <div style="font-weight:600;color:#111827;margin-bottom:6px;">Submission details</div>
                      <div style="color:#374151;font-size:14px;line-height:1.6;">
                        <div><strong>Listing:</strong> ${safeJobLine}</div>
                        <div><strong>Plan:</strong> ${safePlanLine}</div>
                        <div><strong>Stripe session:</strong> ${escapeHtml(session.id)}</div>
                        <div><strong>Buyer email:</strong> ${safeBuyerEmail}</div>
                      </div>
                    </div>
                    <p style="margin:0;">Please review and accept it in the admin dashboard to publish.</p>
                  `,
                  cta: { label: "Review in admin dashboard", href: adminDashboardUrl },
                  footerNote: "This listing will stay pending until approved.",
                }),
              });
              if (adminResult?.error) {
                console.error("Resend admin email failed:", adminResult.error);
                await logEmailIssue(jobId, { type: "admin", error: adminResult.error });
              }
            } catch (error) {
              console.error("Resend unexpected error:", error);
              await logEmailIssue(jobId, { type: "unexpected", error: String(error) });
            }
          } else {
            console.warn("Resend not configured; skipping email notifications.");
            await logEmailIssue(jobId, { type: "missing_resend", message: "RESEND_API_KEY not set" });
          }
        }
      }
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const jobId = session.metadata?.jobId;
      if (jobId) {
        await supabaseAdmin
          .from("jobs")
          .update({
            stripe_payment_status: "expired",
            stripe_session_id: session.id,
          })
          .eq("id", jobId);
        await supabaseAdmin.from("audit_logs").insert({
          action: "payment_expired",
          job_id: jobId,
          metadata: {
            stripeSessionId: session.id,
            amountTotal: session.amount_total,
            currency: session.currency,
          },
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Webhook handler failed: ${message}` }, { status: 500 });
  }
}
