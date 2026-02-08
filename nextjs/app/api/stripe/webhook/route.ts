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
  if (!stripeKey || !webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook not configured." }, { status: 500 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2026-01-28.clover" });
  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();

  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
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
          const planLine = jobRow?.plan_type ? `${jobRow.plan_type}${jobRow.plan_price ? ` ($${jobRow.plan_price})` : ""}` : "Standard";
          const dashboardUrl = `${baseUrl}/dashboard/employer`;
          const adminDashboardUrl = `${baseUrl}/dashboard/admin`;
          const supportEmail = "info@careerspal.com";

          try {
            if (buyerEmail) {
              const buyerResult = await resend.emails.send({
                from,
                to: buyerEmail,
                subject: "Payment confirmed — your job listing is under review",
                html: `
                  <p>Hi there,</p>
                  <p>Your payment was confirmed and we’ve received your job listing.</p>
                  <p><strong>Listing:</strong> ${jobLine}</p>
                  <p><strong>Plan:</strong> ${planLine}</p>
                  <p>Your listing is now under review and will go live after approval.</p>
                  <p>You can track the status here:</p>
                  <p><a href="${dashboardUrl}">${dashboardUrl}</a></p>
                  <p>If you need to update the listing or have any questions, reply to this email or contact us at <a href="mailto:${supportEmail}">${supportEmail}</a>.</p>
                  <p>Thank you for choosing CareersPal.</p>
                `,
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
              html: `
                <p>A new job has been paid and is waiting for review.</p>
                <ul>
                  <li>Listing: ${jobLine}</li>
                  <li>Plan: ${planLine}</li>
                  <li>Stripe session: ${session.id}</li>
                  <li>Buyer email: ${buyerEmail ?? "Unknown"}</li>
                </ul>
                <p>Please review and accept it in the admin dashboard to publish:</p>
                <p><a href="${adminDashboardUrl}">${adminDashboardUrl}</a></p>
              `,
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
}
