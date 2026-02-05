import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../lib/supabaseServerAuth";

export const runtime = "nodejs";

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

  const body = (await request.json()) as { jobId?: string; price?: number; planName?: string };
  if (!body?.jobId) {
    return NextResponse.json({ error: "Missing jobId." }, { status: 400 });
  }

  const { data: job } = await supabaseAdmin
    .from("jobs")
    .select("id,title,plan_price,plan_type,companies(name)")
    .eq("id", body.jobId)
    .single();
  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const price = body.price || job.plan_price || 79;
  const planName = body.planName || job.plan_type || "Standard";
  const origin = request.headers.get("origin") || process.env.NEXTAUTH_URL || "http://localhost:3000";

  const stripe = new Stripe(stripeKey, { apiVersion: "2026-01-28.clover" });
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${planName} Job Listing`,
            description: `${job.title} at ${job.companies?.name || "Company"}`,
          },
          unit_amount: Math.round(price * 100),
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout?jobId=${job.id}`,
    metadata: {
      jobId: job.id,
    },
  });

  await supabaseAdmin
    .from("jobs")
    .update({
      stripe_session_id: session.id,
      stripe_payment_status: "pending",
    })
    .eq("id", job.id);

  return NextResponse.json({ url: session.url });
}
