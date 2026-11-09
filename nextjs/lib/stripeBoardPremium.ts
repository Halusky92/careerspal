import Stripe from "stripe";
import { supabaseAdmin } from "./supabaseAdmin";

export const PREMIUM_KEEP_STATUSES = new Set(["active", "trialing", "past_due"]);

type PeriodSource = {
  id: string;
  status: string;
  customer?: string | { id?: string } | null;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  cancellation_details?: { reason?: string | null } | null;
  items?: { data: Array<{ current_period_end?: number }> };
};

function customerIdOf(raw: PeriodSource, fallback?: string | null) {
  return (
    fallback ||
    (typeof raw.customer === "string" ? raw.customer : raw.customer?.id || null)
  );
}

function periodEndIso(raw: PeriodSource): string | null {
  const periodEnd =
    typeof raw.current_period_end === "number"
      ? raw.current_period_end
      : raw.items?.data[0]?.current_period_end;
  return typeof periodEnd === "number" ? new Date(periodEnd * 1000).toISOString() : null;
}

export function premiumProfilePatch(args: {
  subscription: PeriodSource;
  customerId?: string | null;
  refunded?: boolean;
}) {
  const raw = args.subscription;
  const until = periodEndIso(raw);
  const untilMs = until ? Date.parse(until) : 0;
  const paidWindowOpen = Number.isFinite(untilMs) && untilMs > Date.now();
  const keepActive = PREMIUM_KEEP_STATUSES.has(raw.status);
  const keepCanceledPaidPeriod = raw.status === "canceled" && paidWindowOpen && !args.refunded;
  const keep = !args.refunded && (keepActive || keepCanceledPaidPeriod);
  return {
    stripe_customer_id: customerIdOf(raw, args.customerId),
    stripe_subscription_id: raw.id,
    stripe_subscription_status: args.refunded ? "canceled" : raw.status,
    board_premium_until: keep ? until : null,
  };
}

export async function profileIdForSubscription(subscription: Stripe.Subscription): Promise<string | null> {
  const fromMeta = (subscription.metadata?.profileId || "").trim();
  if (fromMeta) return fromMeta;
  if (!supabaseAdmin) return null;
  const { data: bySub } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();
  if ((bySub as { id?: string } | null)?.id) return (bySub as { id: string }).id;
  const customerId = customerIdOf(subscription as PeriodSource);
  if (!customerId) return null;
  return profileIdForStripeCustomer(customerId);
}

export async function profileIdForStripeCustomer(customerId: string): Promise<string | null> {
  if (!supabaseAdmin || !customerId) return null;
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return (data as { id?: string } | null)?.id || null;
}

export async function applyBoardSubscription(args: {
  profileId: string;
  subscription: Stripe.Subscription;
  customerId?: string | null;
  refunded?: boolean;
}) {
  if (!supabaseAdmin) return;
  const patch = premiumProfilePatch({
    subscription: args.subscription as Stripe.Subscription & {
      current_period_end?: number;
    },
    customerId: args.customerId,
    refunded: args.refunded,
  });
  await supabaseAdmin.from("profiles").update(patch).eq("id", args.profileId);
}
