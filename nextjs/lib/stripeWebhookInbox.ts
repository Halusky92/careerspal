import type { SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";

export function stripeWebhookSecrets(): string[] {
  return [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_WEBHOOK_SECRET_SECOND]
    .map((value) => (value || "").trim())
    .filter(Boolean);
}

export function constructStripeEvent(args: {
  stripe: Stripe;
  payload: string;
  signature: string;
  secrets: string[];
}): Stripe.Event {
  let lastError: unknown = null;
  for (const secret of args.secrets) {
    try {
      return args.stripe.webhooks.constructEvent(args.payload, args.signature, secret);
    } catch (err) {
      lastError = err;
    }
  }
  const message = lastError instanceof Error ? lastError.message : "Invalid signature.";
  throw new Error(message);
}

export async function claimStripeEvent(
  sb: SupabaseClient,
  event: { id: string; type: string },
): Promise<"claimed" | "duplicate" | "unavailable"> {
  const { error } = await sb.from("stripe_webhook_events").insert({
    event_id: event.id,
    event_type: event.type,
  });
  if (!error) return "claimed";
  const code = (error as { code?: string }).code;
  if (code === "23505") return "duplicate";
  const message = (error as { message?: string }).message || "";
  if (/stripe_webhook_events/i.test(message) && /does not exist|schema cache|relation/i.test(message)) {
    return "unavailable";
  }
  throw new Error(message || "Unable to claim Stripe event.");
}
