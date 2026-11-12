import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import type { StripeScopeReader } from "../../../../lib/stripeWebhookInbox";
import { stripeKeyForEventMode } from "../../../../lib/boardAccess";

type StripeEmailJobRow = {
  id: string;
  title: string;
  plan_type: string | null;
  plan_price: number | null;
  companies?: { name?: string | null } | Array<{ name?: string | null }> | null;
};

export const runtime = "nodejs";

async function applyKnownPremiumSubscription(
  db: NonNullable<typeof supabaseAdmin>,
  subscription: Stripe.Subscription,
  extra?: { refunded?: boolean; customerId?: string | null; allowExtend?: boolean },
) {
  const { applyBoardSubscription, profileIdForSubscription, subscriptionGrantsPremium } = await import("../../../../lib/stripeBoardPremium");
  const profileId = await profileIdForSubscription(subscription);
  if (!profileId) return null;
  const { data, error } = await db.from("profiles").select("stripe_subscription_id").eq("id", profileId).maybeSingle();
  if (error) throw new Error(error.message || "Unable to read Premium subscription.");
  const stored = (data as { stripe_subscription_id?: string | null } | null)?.stripe_subscription_id;
  if (!subscriptionGrantsPremium({
    purpose: subscription.metadata?.purpose,
    subscriptionId: subscription.id,
    storedSubscriptionId: stored,
  })) {
    return null;
  }
  await applyBoardSubscription({
    profileId,
    subscription,
    customerId: extra?.customerId,
    refunded: extra?.refunded,
    allowExtend: extra?.allowExtend,
  });
  return profileId;
}

async function employerListingIdFromCharge(stripe: Stripe, charge: Stripe.Charge): Promise<string | null> {
  const { employerJobIdFromMetadata } = await import("../../../../lib/employerPlans");
  const fromCharge = employerJobIdFromMetadata(charge.metadata);
  if (fromCharge) return fromCharge;
  const paymentIntent = charge.payment_intent;
  const paymentIntentId = typeof paymentIntent === "string" ? paymentIntent : paymentIntent?.id;
  if (!paymentIntentId) return null;
  const intent =
    typeof paymentIntent === "object" && paymentIntent?.metadata
      ? paymentIntent
      : await stripe.paymentIntents.retrieve(paymentIntentId);
  return employerJobIdFromMetadata(intent.metadata);
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/stripe/webhook",
    method: "POST",
    events: [
      "checkout.session.completed",
      "checkout.session.async_payment_failed",
      "checkout.session.expired",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "invoice.paid",
      "invoice.payment_failed",
      "charge.refunded",
    ],
  });
}

export async function POST(request: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const { stripeWebhookSecrets, constructStripeEvent, runStripeEventOnce, acceptsResolvedAppEnv, resolveStripeEventAppEnv, stripeAppEnv, stripeModeMismatch } = await import("../../../../lib/stripeWebhookInbox");
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
  const db = supabaseAdmin;

  let eventId = "";
  try {
    const verifyStripe = new Stripe(stripeKey, { apiVersion: "2026-01-28.clover" });
    const signature = request.headers.get("stripe-signature");
    const payload = await request.text();

    if (!signature) {
      return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = constructStripeEvent({
        stripe: verifyStripe,
        payload,
        signature,
        secrets: webhookSecrets,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid signature.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    eventId = event.id;
    const eventKey = stripeKeyForEventMode(event.livemode);
    const stripe = eventKey && eventKey !== stripeKey
      ? new Stripe(eventKey, { apiVersion: "2026-01-28.clover" })
      : verifyStripe;

    const eventAppEnv = await resolveStripeEventAppEnv(stripe as unknown as StripeScopeReader, event);
    if (!acceptsResolvedAppEnv(eventAppEnv, stripeAppEnv())) {
      return NextResponse.json({ received: true, ignored: true });
    }

    const outcome = await runStripeEventOnce({
      sb: db,
      event,
      work: async () => {
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
            allowExtend: true,
          });
          const { sendPremiumReceipt } = await import("../../../../lib/premiumReceipt");
          const periodSource = subscription as {
            current_period_end?: number;
            items?: { data?: Array<{ current_period_end?: number }> };
          };
          const periodEnd = periodSource.current_period_end || periodSource.items?.data?.[0]?.current_period_end;
          await sendPremiumReceipt({
            to: session.customer_details?.email || session.customer_email || null,
            until: typeof periodEnd === "number" ? new Date(periodEnd * 1000).toISOString() : null,
          });
          await db.from("audit_logs").insert({
            action: "board_access_paid",
            metadata: {
              profileId,
              stripeSessionId: session.id,
              subscriptionId: subId,
              amountTotal: session.amount_total,
              currency: session.currency,
              renews: true,
            },
          });
        }
        return;
      }
      const jobId = session.metadata?.jobId;
      if (jobId) {
        const { employerCheckoutPatch } = await import("../../../../lib/employerPlans");
        const { data: paidJob } = await db
          .from("jobs")
          .select("status,plan_type,plan_price,stripe_payment_status,stripe_session_id")
          .eq("id", jobId)
          .maybeSingle();
        const jobRow = (paidJob || {}) as {
          status?: string | null;
          plan_type?: string | null;
          plan_price?: number | null;
          stripe_payment_status?: string | null;
          stripe_session_id?: string | null;
        };
        const expectedCents = Number(session.metadata?.amountCents || "");
        const planType = session.metadata?.planType || jobRow.plan_type || "Standard";
        const decision = employerCheckoutPatch({
          job: jobRow,
          sessionId: session.id,
          paymentStatus: session.payment_status,
          currency: session.currency,
          amountTotal: session.amount_total,
          expectedCents: Number.isFinite(expectedCents) ? expectedCents : -1,
          planType,
        });
        if (!("ignore" in decision)) {
          let paidWrite = await db.from("jobs").update(decision.update).eq("id", jobId);
          if (paidWrite.error && "unpublished_at" in decision.update) {
            const { unpublished_at: _unpublished, ...withoutUnpublished } = decision.update;
            paidWrite = await db.from("jobs").update(withoutUnpublished).eq("id", jobId);
          }
          if (paidWrite.error) throw new Error(paidWrite.error.message || "Employer payment update failed.");
          await db.from("audit_logs").insert({
            action: decision.audit,
            job_id: jobId,
            metadata: {
              stripeSessionId: session.id,
              amountTotal: session.amount_total,
              currency: session.currency,
              paymentStatus: session.payment_status,
              expectedCents,
            },
          });
        }

        if (!("ignore" in decision) && decision.update.stripe_payment_status === "paid") {
          const { sendListingOutcomeEmails } = await import("../../../../lib/listingNotify");
          const { data: job } = await db
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
            const { data: poster } = await db.from("profiles").select("email").eq("id", jobRow.created_by).maybeSingle();
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
      const profileId = await applyKnownPremiumSubscription(db, subscription);
      if (profileId) {
        await db.from("audit_logs").insert({
          action: event.type === "customer.subscription.deleted" ? "board_access_canceled" : "board_access_updated",
          metadata: { profileId, subscriptionId: subscription.id, status: subscription.status },
        });
      }
    }

    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const employerJobId = await employerListingIdFromCharge(stripe, charge);
      if (employerJobId) {
        const { employerRefundAction, writeEmployerRefund } = await import("../../../../lib/employerPlans");
        const refundAction = employerRefundAction({
          amount: charge.amount,
          amountRefunded: charge.amount_refunded,
          refunded: charge.refunded,
        });
        if (refundAction === "partial" || refundAction === "full") {
          const { data: refundJob } = refundAction === "full"
            ? await db.from("jobs").select("status,stripe_payment_status").eq("id", employerJobId).maybeSingle()
            : { data: null };
          const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id || null;
          await writeEmployerRefund(db, {
            action: refundAction,
            jobId: employerJobId,
            chargeId: charge.id,
            paymentIntentId,
            amount: charge.amount,
            amountRefunded: charge.amount_refunded,
            job: refundJob,
          });
        }
      } else if (charge.refunded) {
        const customerId = typeof charge.customer === "string" ? charge.customer : charge.customer?.id || null;
        let profileId: string | null = null;
        const subRef = (charge as Stripe.Charge & { invoice?: string | { subscription?: string | null } }).invoice;
        if (typeof subRef === "object" && subRef?.subscription) {
          const subscription = await stripe.subscriptions.retrieve(String(subRef.subscription));
          profileId = await applyKnownPremiumSubscription(db, subscription, { refunded: true, customerId });
        } else if (customerId) {
          const { profileIdForStripeCustomer } = await import("../../../../lib/stripeBoardPremium");
          const owner = await profileIdForStripeCustomer(String(customerId));
          if (owner) {
            const { data } = await db
              .from("profiles")
              .select("stripe_subscription_id")
              .eq("id", owner)
              .maybeSingle();
            const subId = (data as { stripe_subscription_id?: string | null } | null)?.stripe_subscription_id;
            if (subId) {
              const subscription = await stripe.subscriptions.retrieve(subId);
              profileId = await applyKnownPremiumSubscription(db, subscription, {
                refunded: true,
                customerId: String(customerId),
              });
            }
          }
        }
        if (profileId) {
          await db.from("audit_logs").insert({
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
        const profileId = await applyKnownPremiumSubscription(db, subscription, { allowExtend: true });
        if (profileId) {
          await db.from("audit_logs").insert({
            action: "board_access_renewed",
            metadata: {
              profileId,
              subscriptionId: subscription.id,
              invoiceId: invoice.id,
              amountPaid: invoice.amount_paid,
              currency: invoice.currency,
              renews: true,
            },
          });
        }
      }
    }

    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice & {
        subscription?: string | { id: string } | null;
        parent?: { subscription_details?: { subscription?: string | null } | null } | null;
      };
      const subRef = invoice.subscription || invoice.parent?.subscription_details?.subscription;
      if (subRef) {
        const subId = typeof subRef === "string" ? subRef : subRef.id;
        const subscription = await stripe.subscriptions.retrieve(subId);
        const profileId = await applyKnownPremiumSubscription(db, subscription);
        if (profileId) {
          await db.from("audit_logs").insert({
            action: "board_access_payment_failed",
            metadata: { profileId, subscriptionId: subscription.id, invoiceId: invoice.id, status: subscription.status },
          });
        }
      }
    }

    if (event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const jobId = session.metadata?.jobId;
      if (jobId) {
        const failedWrite = await db
          .from("jobs")
          .update({ stripe_payment_status: "unpaid", stripe_session_id: session.id })
          .eq("id", jobId)
          .neq("stripe_payment_status", "paid")
          .neq("status", "published");
        if (failedWrite.error) throw new Error(failedWrite.error.message || "Payment failure update failed.");
      }
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const jobId = session.metadata?.jobId;
      if (jobId) {
        const expiredWrite = await db
          .from("jobs")
          .update({
            stripe_payment_status: "expired",
            stripe_session_id: session.id,
          })
          .eq("id", jobId)
          .neq("stripe_payment_status", "paid")
          .neq("status", "published")
          .neq("status", "pending_review");
        if (expiredWrite.error) throw new Error(expiredWrite.error.message || "Expired checkout update failed.");
        await db.from("audit_logs").insert({
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
      },
    });
    if (outcome === "duplicate") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    if (stripeModeMismatch(error)) {
      return NextResponse.json({ received: true, ignored: true });
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[stripe-webhook] ${eventId} ${message}`.slice(0, 240));
    return NextResponse.json({ error: `Webhook handler failed: ${message}` }, { status: 500 });
  }
}
