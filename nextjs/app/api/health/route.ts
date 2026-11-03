import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { resendFromHost } from "../../../lib/resendFrom";

export const runtime = "nodejs";

export async function GET() {
  const stripeKey = process.env.STRIPE_SECRET_KEY || "";
  const hasStripe = Boolean(stripeKey);
  const hasWebhook = Boolean(process.env.STRIPE_WEBHOOK_SECRET);
  const stripeTestMode = stripeKey.startsWith("sk_test_");
  const hasResend = Boolean(process.env.RESEND_API_KEY);
  const resendHost = resendFromHost();
  const gitSha =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_REF ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    null;

  if (!supabaseAdmin) {
    return NextResponse.json(
      {
        ok: false,
        supabase: false,
        stripe: hasStripe,
        stripeWebhook: hasWebhook,
        stripeTestMode,
        resend: hasResend,
        resendHost,
        gitSha,
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
      stripeTestMode,
      resend: hasResend,
      resendHost,
      gitSha,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        supabase: false,
        stripe: hasStripe,
        stripeWebhook: hasWebhook,
        stripeTestMode,
        resend: hasResend,
        resendHost,
        gitSha,
      },
      { status: 500 },
    );
  }
}
