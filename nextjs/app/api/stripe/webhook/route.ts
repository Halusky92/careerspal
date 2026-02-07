import { NextResponse } from "next/server";
import Stripe from "stripe";
import { Resend } from "resend";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

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

const getAdminEmail = () => {
  return process.env.ADMIN_NOTIFICATION_EMAIL || "info@careerspal.com";
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
          const companyName = Array.isArray(job?.companies) ? job?.companies[0]?.name : job?.companies?.name;
          const buyerEmail = session.customer_details?.email || session.customer_email;
          const from = getFromEmail();
          const jobLine = job ? `${job.title}${companyName ? ` at ${companyName}` : ""}` : "your job listing";
          const planLine = job?.plan_type ? `${job.plan_type}${job.plan_price ? ` ($${job.plan_price})` : ""}` : "Standard";
          const dashboardUrl = `${baseUrl}/dashboard/employer`;

          try {
            if (buyerEmail) {
              await resend.emails.send({
                from,
                to: buyerEmail,
                subject: "Payment received — your job is under review",
                html: `
                  <p>Thanks for your payment. ${jobLine} is now pending review.</p>
                  <p>You can track the status in your dashboard:</p>
                  <p><a href="${dashboardUrl}">${dashboardUrl}</a></p>
                `,
              });
            }

            await resend.emails.send({
              from,
              to: getAdminEmail(),
              subject: "New paid job pending review",
              html: `
                <p>A new job has been paid and is waiting for review.</p>
                <ul>
                  <li>Listing: ${jobLine}</li>
                  <li>Plan: ${planLine}</li>
                  <li>Stripe session: ${session.id}</li>
                </ul>
                <p>Review it in the admin dashboard:</p>
                <p><a href="${baseUrl}/dashboard/admin">${baseUrl}/dashboard/admin</a></p>
              `,
            });
          } catch {
            // Email failures should not block webhook
          }
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
