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

export type StripeAppEnv = "production" | "staging";

export function stripeAppEnv(staging = process.env.STAGING): StripeAppEnv {
  return staging === "1" ? "staging" : "production";
}

export function stripeScopeMetadata(metadata: Record<string, string>, staging = process.env.STAGING) {
  return { ...metadata, app_env: stripeAppEnv(staging) };
}

function metadataAppEnv(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as { app_env?: unknown }).app_env;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Reads app_env from the event object, including an invoice's subscription snapshot. */
export function stripeEventAppEnv(event: { data?: { object?: unknown } }): string | null {
  const object = event.data?.object as {
    metadata?: unknown;
    parent?: { subscription_details?: { metadata?: unknown } | null } | null;
    lines?: { data?: Array<{ metadata?: unknown }> } | null;
  } | null;
  if (!object) return null;
  const direct = metadataAppEnv(object.metadata);
  if (direct) return direct;
  const parent = metadataAppEnv(object.parent?.subscription_details?.metadata);
  if (parent) return parent;
  for (const line of object.lines?.data || []) {
    const fromLine = metadataAppEnv(line.metadata);
    if (fromLine) return fromLine;
  }
  return null;
}

/** Production keeps untagged legacy events. Staging handles only events proven to be staging. */
export function acceptsResolvedAppEnv(tagged: string | null, appEnv: StripeAppEnv = stripeAppEnv()) {
  if (appEnv === "staging") return tagged === "staging";
  return tagged !== "staging";
}

export function acceptsStripeEvent(
  event: { data?: { object?: unknown } },
  appEnv: StripeAppEnv = stripeAppEnv(),
) {
  return acceptsResolvedAppEnv(stripeEventAppEnv(event), appEnv);
}

type ScopeObject = {
  metadata?: unknown;
  subscription?: unknown;
  payment_intent?: unknown;
  invoice?: unknown;
  parent?: { subscription_details?: { metadata?: unknown; subscription?: unknown } | null } | null;
  lines?: { data?: Array<{ metadata?: unknown }> } | null;
};

export type StripeScopeReader = {
  subscriptions: { retrieve: (id: string) => Promise<unknown> };
  paymentIntents: { retrieve: (id: string) => Promise<unknown> };
  invoices: { retrieve: (id: string) => Promise<unknown> };
  invoicePayments?: {
    list: (params: { payment?: { type?: string; payment_intent?: string }; limit?: number }) => Promise<unknown>;
  };
};

function idOf(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string") {
    const id = (value as { id: string }).id.trim();
    return id || null;
  }
  return null;
}

async function appEnvFromSubscription(reader: StripeScopeReader, subscriptionId: string) {
  const subscription = (await reader.subscriptions.retrieve(subscriptionId)) as { metadata?: unknown };
  return metadataAppEnv(subscription?.metadata);
}

async function appEnvFromInvoice(reader: StripeScopeReader, invoiceId: string): Promise<string | null> {
  const invoice = (await reader.invoices.retrieve(invoiceId)) as ScopeObject;
  const direct = stripeEventAppEnv({ data: { object: invoice } });
  if (direct) return direct;
  const subscriptionId =
    idOf(invoice?.subscription) || idOf(invoice?.parent?.subscription_details?.subscription);
  return subscriptionId ? appEnvFromSubscription(reader, subscriptionId) : null;
}

async function invoiceIdForPaymentIntent(reader: StripeScopeReader, paymentIntentId: string) {
  if (!reader.invoicePayments) return null;
  const list = (await reader.invoicePayments.list({
    payment: { type: "payment_intent", payment_intent: paymentIntentId },
    limit: 1,
  })) as { data?: Array<{ invoice?: unknown }> };
  return idOf(list?.data?.[0]?.invoice);
}

/**
 * app_env on the event wins. Invoice and refund events often omit it, so the related
 * subscription or payment is the source of truth. A failed lookup throws instead of
 * treating the event as production.
 */
export async function resolveStripeEventAppEnv(
  reader: StripeScopeReader,
  event: { type?: string; data?: { object?: unknown } },
): Promise<string | null> {
  const direct = stripeEventAppEnv(event);
  if (direct) return direct;
  const object = (event.data?.object || null) as ScopeObject | null;
  if (!object) return null;

  if (event.type === "checkout.session.completed") {
    const subscriptionId = idOf(object.subscription);
    return subscriptionId ? appEnvFromSubscription(reader, subscriptionId) : null;
  }
  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const subscriptionId = idOf(object.subscription) || idOf(object.parent?.subscription_details?.subscription);
    return subscriptionId ? appEnvFromSubscription(reader, subscriptionId) : null;
  }
  if (event.type === "charge.refunded") {
    const expandedIntent = typeof object.payment_intent === "object" ? object.payment_intent : null;
    const fromExpanded = metadataAppEnv((expandedIntent as { metadata?: unknown } | null)?.metadata);
    if (fromExpanded) return fromExpanded;
    const paymentIntentId = idOf(object.payment_intent);
    let invoiceId = idOf((expandedIntent as { invoice?: unknown } | null)?.invoice) || idOf(object.invoice);
    if (paymentIntentId && !expandedIntent) {
      const intent = (await reader.paymentIntents.retrieve(paymentIntentId)) as {
        metadata?: unknown;
        invoice?: unknown;
      };
      const fromIntent = metadataAppEnv(intent?.metadata);
      if (fromIntent) return fromIntent;
      invoiceId = invoiceId || idOf(intent?.invoice) || (await invoiceIdForPaymentIntent(reader, paymentIntentId));
    } else if (paymentIntentId && !invoiceId) {
      invoiceId = await invoiceIdForPaymentIntent(reader, paymentIntentId);
    }
    if (invoiceId) return appEnvFromInvoice(reader, invoiceId);
  }
  return null;
}
