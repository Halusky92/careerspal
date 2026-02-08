import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET() {
  const hasStripe = Boolean(process.env.STRIPE_SECRET_KEY);
  const hasWebhook = Boolean(process.env.STRIPE_WEBHOOK_SECRET);

  if (!supabaseAdmin) {
    return NextResponse.json(
      {
        ok: false,
        supabase: false,
        stripe: hasStripe,
        stripeWebhook: hasWebhook,
      },
      { status: 500 },
    );
  }

  try {
    await supabaseAdmin.from("jobs").select("id").limit(1);
    return NextResponse.json({
      ok: true,
      supabase: true,
      stripe: hasStripe,
      stripeWebhook: hasWebhook,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        supabase: false,
        stripe: hasStripe,
        stripeWebhook: hasWebhook,
      },
      { status: 500 },
    );
  }
}
