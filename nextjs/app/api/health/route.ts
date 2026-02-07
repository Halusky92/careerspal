import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const runtime = "nodejs";

export const GET = async () => {
  const hasSupabase = Boolean(supabaseAdmin);
  const hasStripe = Boolean(process.env.STRIPE_SECRET_KEY);
  const hasWebhook = Boolean(process.env.STRIPE_WEBHOOK_SECRET);

  return NextResponse.json({
    ok: true,
    supabase: hasSupabase,
    stripe: hasStripe,
    stripeWebhook: hasWebhook,
  });
};
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export async function GET() {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ status: "error" }, { status: 500 });
    }
    await supabaseAdmin.from("jobs").select("id").limit(1);
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
