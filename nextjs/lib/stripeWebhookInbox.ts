import type { SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const PROCESSING_SUFFIX = "#processing";
const IN_PROGRESS_MS = 20_000;

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

export function processingEventType(type: string) {
  return `${type}${PROCESSING_SUFFIX}`;
}

function missingEventsTable(message: string) {
  return /stripe_webhook_events/i.test(message) && /does not exist|schema cache|relation/i.test(message);
}

type EventRow = { event_type?: string | null; received_at?: string | null };

async function readStripeEvent(sb: SupabaseClient, eventId: string): Promise<EventRow | null> {
  const { data, error } = await sb
    .from("stripe_webhook_events")
    .select("event_type,received_at")
    .eq("event_id", eventId)
    .maybeSingle();
  if (error) {
    if (missingEventsTable(error.message || "")) return null;
    throw new Error(error.message || "Unable to read Stripe event.");
  }
  return (data as EventRow | null) || null;
}

export async function beginStripeEvent(
  sb: SupabaseClient,
  event: { id: string; type: string },
): Promise<"started" | "duplicate" | "in_progress" | "unavailable"> {
  const processing = processingEventType(event.type);
  const { error } = await sb.from("stripe_webhook_events").insert({
    event_id: event.id,
    event_type: processing,
  });
  if (!error) return "started";
  const code = (error as { code?: string }).code;
  const message = (error as { message?: string }).message || "";
  if (missingEventsTable(message)) return "unavailable";
  if (code !== "23505") throw new Error(message || "Unable to start Stripe event.");

  const existing = await readStripeEvent(sb, event.id);
  if (!existing) return "unavailable";
  if (existing.event_type === event.type) return "duplicate";
  if (existing.event_type !== processing) return "duplicate";
  const age = Date.now() - Date.parse(existing.received_at || "");
  if (!Number.isFinite(age) || age < IN_PROGRESS_MS) return "in_progress";

  const takeover = await sb
    .from("stripe_webhook_events")
    .update({ received_at: new Date().toISOString() })
    .eq("event_id", event.id)
    .eq("event_type", processing);
  if (takeover.error) throw new Error(takeover.error.message || "Unable to resume Stripe event.");
  return "started";
}

export async function completeStripeEvent(sb: SupabaseClient, event: { id: string; type: string }) {
  const { error } = await sb
    .from("stripe_webhook_events")
    .update({ event_type: event.type })
    .eq("event_id", event.id)
    .eq("event_type", processingEventType(event.type));
  if (error && !missingEventsTable(error.message || "")) {
    throw new Error(error.message || "Unable to finish Stripe event.");
  }
}

export async function releaseStripeEvent(sb: SupabaseClient, event: { id: string; type: string }) {
  const { error } = await sb
    .from("stripe_webhook_events")
    .delete()
    .eq("event_id", event.id)
    .eq("event_type", processingEventType(event.type));
  if (error && !missingEventsTable(error.message || "")) {
    throw new Error(error.message || "Unable to release Stripe event.");
  }
}

/** Runs the critical writes once. A failure deletes the in-progress mark so Stripe can retry. */
export async function runStripeEventOnce(args: {
  sb: SupabaseClient;
  event: { id: string; type: string };
  work: () => Promise<void>;
}): Promise<"done" | "duplicate"> {
  const claim = await beginStripeEvent(args.sb, args.event);
  if (claim === "duplicate") return "duplicate";
  if (claim === "in_progress") throw new Error("Stripe event is still in progress.");
  if (claim === "unavailable") {
    await args.work();
    return "done";
  }
  try {
    await args.work();
  } catch (error) {
    await releaseStripeEvent(args.sb, args.event);
    throw error;
  }
  await completeStripeEvent(args.sb, args.event);
  return "done";
}
