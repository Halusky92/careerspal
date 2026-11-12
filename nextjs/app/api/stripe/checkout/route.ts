import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../lib/supabaseServerAuth";
import { checkRateLimit } from "../../../../lib/rateLimit";
import { canRenewUnpublished, RENEW_PLAN_NAME } from "../../../../lib/jobs/unpublishedRetention";
import { getPublicSiteUrl } from "../../../../lib/alerts/siteUrl";
import { screenListingForBoard } from "../../../../lib/jobs/autoReviewListing";
import { verifyScreenPass } from "../../../../lib/jobs/screenPass";
import { canUseAdminTestPlan } from "../../../../lib/adminTestPlan";
import {
  premiumCheckoutOpen,
  premiumLiveBuyerAllowed,
  premiumPriceIdForKey,
  premiumPriceIsMonthly799,
  premiumSubscriptionBlocksNewCheckout,
  resolvePremiumStripeKey,
} from "../../../../lib/boardAccess";
import { chargeForStoredJob, resolveEmployerStripeKey } from "../../../../lib/employerPlans";
import { stripeScopeMetadata } from "../../../../lib/stripeWebhookInbox";

type StripeJobRow = {
  id: string;
  title: string;
  status?: string | null;
  plan_price: number | null;
  plan_type: string | null;
  created_by?: string | null;
  created_at?: string | null;
  published_at?: string | null;
  unpublished_at?: string | null;
  description?: string | null;
  salary?: string | null;
  apply_url?: string | null;
  location?: string | null;
  remote_policy?: string | null;
  timestamp?: number | null;
  companies?: { name?: string | null } | Array<{ name?: string | null }> | null;
};

export const runtime = "nodejs";

export async function GET() {
  const premiumKey = resolvePremiumStripeKey();
  return NextResponse.json({ available: premiumCheckoutOpen(undefined, premiumKey) });
}

/** Premium returns to the site that started checkout. Production stays on the public URL. */
function boardReturnOrigin(request: Request) {
  const raw = request.headers.get("origin") || "";
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "careerspal-staging.vercel.app") {
      return `${url.protocol}//${url.host}`;
    }
  } catch {
    /* fall through to the public site */
  }
  return getPublicSiteUrl();
}

export async function POST(request: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: "Missing Stripe secret key." }, { status: 500 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }
  const auth = await getSupabaseProfile(request);
  if (!auth?.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (auth.profile.role !== "admin") {
    const limiter = checkRateLimit(`checkout:${auth.profile.id}`, { windowMs: 60_000, max: 20 });
    if (!limiter.allowed) {
      return NextResponse.json({ error: "Too many checkout attempts." }, { status: 429 });
    }
  }

  const body = (await request.json()) as {
    jobId?: string;
    price?: number;
    planName?: string;
    adminInternalPlan?: boolean;
    purpose?: string;
    screenToken?: string;
  };
  if (body.purpose === "board_access") {
    const premiumKey = resolvePremiumStripeKey();
    if (!premiumCheckoutOpen(undefined, premiumKey) || !premiumLiveBuyerAllowed(auth.user.email, premiumKey)) {
      return NextResponse.json({ error: "Premium checkout is not open." }, { status: 403 });
    }
    const origin = boardReturnOrigin(request);
    try {
      const stripe = new Stripe(premiumKey, { apiVersion: "2026-01-28.clover" });
      const priceId = premiumPriceIdForKey(premiumKey);
      if (premiumKey.startsWith("sk_live_")) {
        if (!priceId) {
          return NextResponse.json({ error: "Premium checkout is not open." }, { status: 403 });
        }
        const price = await stripe.prices.retrieve(priceId);
        if (!premiumPriceIsMonthly799(price)) {
          return NextResponse.json({ error: "Premium checkout is not open." }, { status: 403 });
        }
      }
      const { data: billing } = await supabaseAdmin
        .from("profiles")
        .select("stripe_customer_id,stripe_subscription_status")
        .eq("id", auth.profile.id)
        .maybeSingle();
      const billingRow = billing as { stripe_customer_id?: string | null; stripe_subscription_status?: string | null } | null;
      const existingCustomer = billingRow?.stripe_customer_id || undefined;
      if (premiumSubscriptionBlocksNewCheckout([billingRow?.stripe_subscription_status])) {
        return NextResponse.json({ error: "Premium is already active on this account." }, { status: 409 });
      }
      if (existingCustomer) {
        const existing = await stripe.subscriptions.list({ customer: existingCustomer, status: "all", limit: 20 });
        if (premiumSubscriptionBlocksNewCheckout(existing.data.map((subscription) => subscription.status))) {
          return NextResponse.json({ error: "Premium is already active on this account." }, { status: 409 });
        }
      }
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
          priceId
            ? { price: priceId, quantity: 1 }
            : {
                price_data: {
                  currency: "usd",
                  product_data: {
                    name: "CareersPal Premium",
                    description: "Unlimited search results, advanced filters, and daily alerts",
                  },
                  unit_amount: 799,
                  recurring: { interval: "month" },
                },
                quantity: 1,
              },
        ],
        success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/upgrade`,
        client_reference_id: auth.profile.id,
        customer: existingCustomer,
        customer_email: existingCustomer ? undefined : auth.profile.email || undefined,
        metadata: stripeScopeMetadata({
          purpose: "board_access",
          profileId: auth.profile.id,
        }),
        subscription_data: {
          metadata: stripeScopeMetadata({
            purpose: "board_access",
            profileId: auth.profile.id,
          }),
        },
      });
      return NextResponse.json({ url: session.url });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Stripe checkout failed.";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }
  if (!body?.jobId) {
    return NextResponse.json({ error: "Missing jobId." }, { status: 400 });
  }

  let jobQuery = await supabaseAdmin
    .from("jobs")
    .select("id,title,description,salary,apply_url,location,remote_policy,status,plan_price,plan_type,created_by,created_at,published_at,unpublished_at,timestamp,companies(name)")
    .eq("id", body.jobId)
    .single();
  if (jobQuery.error) {
    jobQuery = await supabaseAdmin
      .from("jobs")
      .select("id,title,description,salary,apply_url,location,remote_policy,status,plan_price,plan_type,created_by,created_at,published_at,timestamp,companies(name)")
      .eq("id", body.jobId)
      .single();
  }
  const job = jobQuery.data;
  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const jobRow = job as StripeJobRow;
  const isOwner = jobRow.created_by && jobRow.created_by === auth.profile.id;
  if (!isOwner && auth.profile.role !== "admin") {
    return NextResponse.json(
      { error: "This listing is linked to a different account. Please resubmit the role from your account." },
      { status: 403 },
    );
  }
  const companyName = Array.isArray(jobRow.companies) ? jobRow.companies[0]?.name : jobRow.companies?.name;
  const listingFields = {
    title: jobRow.title,
    description: jobRow.description,
    salary: jobRow.salary,
    apply_url: jobRow.apply_url,
    company: companyName,
    location: jobRow.location,
    remote_policy: jobRow.remote_policy,
  };
  const skipAi = verifyScreenPass(body.screenToken, listingFields);
  const screen = await screenListingForBoard(listingFields, { skipAi });
  if (screen.decision !== "publish") {
    return NextResponse.json(
      {
        error: screen.reasons[0] || "This listing does not meet the board bar yet.",
        issues: screen.issues,
        reasons: screen.reasons,
      },
      { status: 400 },
    );
  }
  const isRenew = body.purpose === "republish" || body.purpose === "renew";
  if (isRenew && !canRenewUnpublished(jobRow)) {
    return NextResponse.json(
      { error: "This listing can no longer be renewed. Unpublished listings are removed after 90 days." },
      { status: 400 },
    );
  }
  const charge = chargeForStoredJob({
    planType: jobRow.plan_type,
    planPrice: jobRow.plan_price,
    renew: isRenew,
  });
  if ("error" in charge) {
    return NextResponse.json({ error: charge.error }, { status: 400 });
  }
  if (charge.adminTest && !canUseAdminTestPlan({ role: auth.profile.role, email: auth.profile.email })) {
    return NextResponse.json({ error: "The $1 test plan is for admins." }, { status: 403 });
  }
  const employerKey = resolveEmployerStripeKey();
  if (!employerKey) {
    return NextResponse.json({ error: "Employer checkout is available in Stripe test mode." }, { status: 403 });
  }
  const planName = isRenew ? RENEW_PLAN_NAME : charge.planType;
  const origin =
    (request.headers.get("origin") || "").replace(/\/+$/, "") || getPublicSiteUrl();

  try {
    const stripe = new Stripe(employerKey, { apiVersion: "2026-01-28.clover" });
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: isRenew
                ? `${planName} listing renewal`
                : charge.adminTest
                  ? "CareersPal admin Stripe test"
                  : `${planName} Job Listing`,
              description: `${jobRow.title} at ${companyName || "Company"}`,
            },
            unit_amount: charge.unitAmountCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout?jobId=${jobRow.id}`,
      metadata: stripeScopeMetadata({
        jobId: jobRow.id,
        purpose: isRenew ? "republish" : "new",
        planType: planName,
        amountCents: String(charge.unitAmountCents),
        currency: "usd",
      }),
      payment_intent_data: {
        metadata: stripeScopeMetadata({
          jobId: jobRow.id,
          purpose: "employer_listing",
          planType: planName,
          amountCents: String(charge.unitAmountCents),
        }),
      },
    });

    await supabaseAdmin
      .from("jobs")
      .update({
        stripe_session_id: session.id,
        stripe_payment_status: "pending",
      })
      .eq("id", jobRow.id);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe checkout failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
