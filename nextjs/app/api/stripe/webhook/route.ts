import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";

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
