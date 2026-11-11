import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseProfile } from "../../../../lib/supabaseServerAuth";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getPublicSiteUrl } from "../../../../lib/alerts/siteUrl";
import { premiumLiveBuyerAllowed, resolvePremiumStripeKey } from "../../../../lib/boardAccess";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const employerKey = process.env.STRIPE_SECRET_KEY || "";
  const premiumKey = resolvePremiumStripeKey();
  if (!supabaseAdmin || (!employerKey && !premiumKey)) {
    return NextResponse.json({ error: "Checkout is not configured." }, { status: 500 });
  }
  const auth = await getSupabaseProfile(request);
  if (!auth?.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const stripeKey = premiumKey.startsWith("sk_live_") && premiumLiveBuyerAllowed(auth.profile.email, premiumKey)
    ? premiumKey
    : employerKey.startsWith("sk_test_")
      ? employerKey
      : premiumKey.startsWith("sk_test_")
        ? premiumKey
        : "";
  if (!stripeKey) {
    return NextResponse.json({ error: "Premium billing is available in Stripe test mode." }, { status: 403 });
  }
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", auth.profile.id)
    .maybeSingle();
  const customerId = (data as { stripe_customer_id?: string | null } | null)?.stripe_customer_id;
  if (!customerId) {
    return NextResponse.json({ error: "No Stripe customer on this account yet." }, { status: 400 });
  }
  const origin = (request.headers.get("origin") || "").replace(/\/+$/, "") || getPublicSiteUrl();
  const stripe = new Stripe(stripeKey, { apiVersion: "2026-01-28.clover" });
  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/account?tab=settings`,
  });
  return NextResponse.json({ url: portal.url });
}
