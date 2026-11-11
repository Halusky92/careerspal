import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

type StripeEmailJobRow = {
  id: string;
  title: string;
  plan_type: string | null;
  plan_price: number | null;
  companies?: { name?: string | null } | Array<{ name?: string | null }> | null;
};

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/stripe/webhook",
    method: "POST",
    events: [
      "checkout.session.completed",
      "checkout.session.expired",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "invoice.paid",
      "charge.refunded",
    ],
  });
}

export async function POST(request: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const { stripeWebhookSecrets, constructStripeEvent, claimStripeEvent } = await import("../../../../lib/stripeWebhookInbox");
  const webhookSecrets = stripeWebhookSecrets();
  if (!stripeKey) {
    return NextResponse.json(
      { error: "Missing STRIPE_SECRET_KEY (required for Stripe SDK initialization)." },
      { status: 500 },
    );
  }
  if (webhookSecrets.length === 0) {
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
      event = constructStripeEvent({
        stripe,
        payload,
        signature,
        secrets: webhookSecrets,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid signature.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const claim = await claimStripeEvent(supabaseAdmin, event);
    if (claim === "duplicate") {
      return NextResponse.json({ received: true, duplicate: true });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.purpose === "board_access") {
        const { applyBoardSubscription, profileIdForStripeCustomer } = await import("../../../../lib/stripeBoardPremium");
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
        const profileId =
          (session.metadata.profileId || "").trim() ||
          (customerId ? await profileIdForStripeCustomer(customerId) : null);
        if (profileId && session.subscription) {
          const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          const subscription = await stripe.subscriptions.retrieve(subId);
          await applyBoardSubscription({
            profileId,
            subscription,
            customerId,
          });
          await supabaseAdmin.from("audit_logs").insert({
            action: "board_access_paid",
            metadata: { profileId, stripeSessionId: session.id, subscriptionId: subId },
          });
        }
        return NextResponse.json({ received: true });
      }
      const jobId = session.metadata?.jobId;
      if (jobId) {
        const isPaid = session.payment_status === "paid";
        const { data: paidJob } = await supabaseAdmin
          .from("jobs")
          .select("plan_type")
          .eq("id", jobId)
          .maybeSingle();
        const paidPlan = (paidJob as { plan_type?: string | null } | null)?.plan_type;
        const featuredPlan = paidPlan === "Featured Pro" || paidPlan === "Elite Managed";
        const paidUpdate: Record<string, unknown> = {
          status: isPaid ? "pending_review" : "draft",
          stripe_payment_status: session.payment_status || (isPaid ? "paid" : "unpaid"),
          stripe_session_id: session.id,
          posted_at_text: isPaid ? "Pending review" : undefined,
          timestamp: isPaid ? Date.now() : undefined,
          is_featured: isPaid ? featuredPlan : false,
          unpublished_at: isPaid ? null : undefined,
        };
        const paidWrite = await supabaseAdmin.from("jobs").update(paidUpdate).eq("id", jobId);
        if (paidWrite.error) {
          const { unpublished_at: _unpublished, ...withoutUnpublished } = paidUpdate;
          await supabaseAdmin.from("jobs").update(withoutUnpublished).eq("id", jobId);
        }
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
          const { sendListingOutcomeEmails } = await import("../../../../lib/listingNotify");
          const { data: job } = await supabaseAdmin
            .from("jobs")
            .select("id,title,plan_type,plan_price,company_description,created_by,companies(name)")
            .eq("id", jobId)
            .single();
          const jobRow = (job ?? null) as (StripeEmailJobRow & { company_description?: string | null; created_by?: string | null }) | null;
          const companyName =
            (Array.isArray(jobRow?.companies) ? jobRow?.companies[0]?.name : jobRow?.companies?.name) ||
            (jobRow?.company_description || "").split("\n")[0].trim() ||
            null;
          let buyerEmail = session.customer_details?.email || session.customer_email || null;
          if (!buyerEmail && jobRow?.created_by) {
            const { data: poster } = await supabaseAdmin.from("profiles").select("email").eq("id", jobRow.created_by).maybeSingle();
            buyerEmail = poster?.email || null;
          }
          await sendListingOutcomeEmails({
            jobId,
            title: jobRow?.title,
            companyName,
            planType: jobRow?.plan_type,
            planPrice: jobRow?.plan_price ?? (typeof session.amount_total === "number" ? session.amount_total / 100 : null),
            buyerEmail,
            startPack: false,
            live: false,
            paid: true,
          });
        }
      }
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const { applyBoardSubscription, profileIdForSubscription } = await import("../../../../lib/stripeBoardPremium");
      const profileId = await profileIdForSubscription(subscription);
      if (profileId) {
        await applyBoardSubscription({ profileId, subscription });
        await supabaseAdmin.from("audit_logs").insert({
          action: event.type === "customer.subscription.deleted" ? "board_access_canceled" : "board_access_updated",
          metadata: { profileId, subscriptionId: subscription.id, status: subscription.status },
        });
      }
    }

    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      if (charge.refunded) {
        const { applyBoardSubscription, profileIdForStripeCustomer, profileIdForSubscription } = await import("../../../../lib/stripeBoardPremium");
        const customerId = typeof charge.customer === "string" ? charge.customer : charge.customer || null;
        let profileId = customerId ? await profileIdForStripeCustomer(String(customerId)) : null;
        const subRef = (charge as Stripe.Charge & { invoice?: string | { subscription?: string | null } }).invoice;
        if (!profileId && typeof subRef === "object" && subRef?.subscription) {
          const subscription = await stripe.subscriptions.retrieve(String(subRef.subscription));
          profileId = await profileIdForSubscription(subscription);
          if (profileId) {
            await applyBoardSubscription({ profileId, subscription, refunded: true });
          }
        } else if (profileId && customerId) {
          const { data } = await supabaseAdmin
            .from("profiles")
            .select("stripe_subscription_id")
            .eq("id", profileId)
            .maybeSingle();
          const subId = (data as { stripe_subscription_id?: string | null } | null)?.stripe_subscription_id;
          if (subId) {
            const subscription = await stripe.subscriptions.retrieve(subId);
            await applyBoardSubscription({ profileId, subscription, customerId: String(customerId), refunded: true });
          }
        }
        if (profileId) {
          await supabaseAdmin.from("audit_logs").insert({
            action: "board_access_refunded",
            metadata: { profileId, chargeId: charge.id },
          });
        }
      }
    }

    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice & {
        subscription?: string | { id: string } | null;
        parent?: { subscription_details?: { subscription?: string | null } | null } | null;
      };
      const subRef = invoice.subscription || invoice.parent?.subscription_details?.subscription;
      if (subRef) {
        const subId = typeof subRef === "string" ? subRef : subRef.id;
        const subscription = await stripe.subscriptions.retrieve(subId);
        const { applyBoardSubscription, profileIdForSubscription } = await import("../../../../lib/stripeBoardPremium");
        const profileId = await profileIdForSubscription(subscription);
        if (profileId) {
          await applyBoardSubscription({ profileId, subscription });
          await supabaseAdmin.from("audit_logs").insert({
            action: "board_access_renewed",
            metadata: { profileId, subscriptionId: subscription.id, invoiceId: invoice.id },
          });
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
