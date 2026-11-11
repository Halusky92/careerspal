import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseProfile } from "../../../../lib/supabaseServerAuth";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { stripeKeyForCheckoutSession } from "../../../../lib/boardAccess";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (!auth?.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sessionId = new URL(request.url).searchParams.get("session_id") || "";
  if (!sessionId.startsWith("cs_")) {
    return NextResponse.json({ error: "Missing checkout session." }, { status: 400 });
  }
  const stripeKey = stripeKeyForCheckoutSession(sessionId);
  if (!stripeKey || !supabaseAdmin) {
    return NextResponse.json({ error: "Checkout is not configured." }, { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2026-01-28.clover" });
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return NextResponse.json({ error: "Checkout session not found." }, { status: 404 });
  }
  if (session.metadata?.purpose === "board_access") {
    const paid = session.payment_status === "paid" || session.status === "complete";
    if (paid && session.metadata.profileId === auth.profile.id && session.subscription) {
      const { applyBoardSubscription } = await import("../../../../lib/stripeBoardPremium");
      const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
      const subscription = await stripe.subscriptions.retrieve(subId);
      await applyBoardSubscription({
        profileId: auth.profile.id,
        subscription,
        customerId: typeof session.customer === "string" ? session.customer : session.customer?.id,
        allowExtend: true,
      });
    }
    return NextResponse.json({
      paid,
      paymentStatus: session.payment_status,
      boardAccess: true,
      title: "Premium",
      amount: typeof session.amount_total === "number" ? session.amount_total / 100 : 7.99,
    });
  }
  const jobId = session.metadata?.jobId || "";
  if (!jobId) {
    return NextResponse.json({ error: "This checkout is not tied to a listing." }, { status: 404 });
  }

  const { data: job } = await supabaseAdmin
    .from("jobs")
    .select("id,title,status,plan_type,plan_price,created_by,stripe_session_id")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) {
    return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  }
  const isOwner = job.created_by === auth.profile.id || auth.profile.role === "admin";
  const sessionMatch = job.stripe_session_id === session.id;
  if (!isOwner && !sessionMatch) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const paid = session.payment_status === "paid";
  return NextResponse.json({
    paid,
    paymentStatus: session.payment_status,
    jobId: job.id,
    title: job.title,
    listingStatus: job.status,
    planType: job.plan_type,
    amount: typeof session.amount_total === "number" ? session.amount_total / 100 : job.plan_price,
  });
}
