import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../lib/supabaseServerAuth";
import { checkRateLimit } from "../../../../lib/rateLimit";

type StripeJobRow = {
  id: string;
  title: string;
  plan_price: number | null;
  plan_type: string | null;
  created_by?: string | null;
  companies?: { name?: string | null } | Array<{ name?: string | null }> | null;
};

export const runtime = "nodejs";

const isEmailAllowed = (email?: string | null) => {
  if (!email) return false;
  const allowList = (process.env.ADMIN_TEST_EMAILS || "mb.bilek@gmail.com")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return allowList.includes(email.toLowerCase());
};

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
  const limiter = checkRateLimit(`checkout:${auth.profile.id}`, { windowMs: 60_000, max: 5 });
  if (!limiter.allowed) {
    return NextResponse.json({ error: "Too many checkout attempts." }, { status: 429 });
  }

  const body = (await request.json()) as { jobId?: string; price?: number; planName?: string };
  if (!body?.jobId) {
    return NextResponse.json({ error: "Missing jobId." }, { status: 400 });
  }

  const { data: job } = await supabaseAdmin
    .from("jobs")
    .select("id,title,plan_price,plan_type,created_by,companies(name)")
    .eq("id", body.jobId)
    .single();
  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const jobRow = job as StripeJobRow;
  const isOwner = jobRow.created_by && jobRow.created_by === auth.profile.id;
  if (!isOwner && auth.profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const companyName = Array.isArray(jobRow.companies) ? jobRow.companies[0]?.name : jobRow.companies?.name;
  const price = body.price || jobRow.plan_price || 79;
  if (price < 1) {
    if (auth.profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!isEmailAllowed(auth.profile.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  const planName = body.planName || jobRow.plan_type || "Standard";
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
            description: `${jobRow.title} at ${companyName || "Company"}`,
          },
          unit_amount: Math.round(price * 100),
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout?jobId=${jobRow.id}`,
    metadata: {
      jobId: jobRow.id,
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
}
