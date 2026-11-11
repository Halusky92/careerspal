import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseProfile } from "../../../../lib/supabaseServerAuth";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getPublicSiteUrl } from "../../../../lib/alerts/siteUrl";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey || !supabaseAdmin) {
    return NextResponse.json({ error: "Checkout is not configured." }, { status: 500 });
  }
  const auth = await getSupabaseProfile(request);
  if (!auth?.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
