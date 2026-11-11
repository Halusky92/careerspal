import { isSourcedJobOrigin } from "./sourcing/origin";

/** Server-side employer listing prices. The client never chooses the amount. */
export const EMPLOYER_PLAN_DAYS = 30;

export const EMPLOYER_PLAN_CENTS = {
  Standard: 7900,
  "Featured Pro": 14900,
  "Elite Managed": 24900,
} as const;

export type EmployerPlanName = keyof typeof EMPLOYER_PLAN_CENTS;

const PLAN_NAMES = Object.keys(EMPLOYER_PLAN_CENTS) as EmployerPlanName[];

export function isEmployerPlanName(value: string | null | undefined): value is EmployerPlanName {
  return PLAN_NAMES.includes(value as EmployerPlanName);
}

export function employerPlanCents(plan: string | null | undefined): number | null {
  if (!isEmployerPlanName(plan || "")) return null;
  return EMPLOYER_PLAN_CENTS[plan as EmployerPlanName];
}

export function employerPlanDollars(cents: number): number {
  return Math.round(cents) / 100;
}

/** Featured and Elite are granted only when that exact catalog amount was charged. */
export function featuredForPaidPlan(plan: string | null | undefined, amountCents: number): boolean {
  if (plan === "Featured Pro") return amountCents === EMPLOYER_PLAN_CENTS["Featured Pro"];
  if (plan === "Elite Managed") return amountCents === EMPLOYER_PLAN_CENTS["Elite Managed"];
  return false;
}

export type StoredEmployerPlan = {
  planType: EmployerPlanName | "Standard";
  planPrice: number;
  featured: boolean;
  adminTest: boolean;
  startPack: boolean;
};

/**
 * Price stored on the draft. Client `price` is ignored except the existing admin $1 flag,
 * which is only honored when the caller already proved they may use that test plan.
 */
export function resolveStoredEmployerPlan(input: {
  requestedType?: string | null;
  adminTest?: boolean;
  startPack?: boolean;
}): StoredEmployerPlan | { error: string } {
  if (input.adminTest) {
    return { planType: "Standard", planPrice: 1, featured: false, adminTest: true, startPack: false };
  }
  if (input.startPack) {
    return { planType: "Standard", planPrice: 0, featured: false, adminTest: false, startPack: true };
  }
  const planType = (input.requestedType || "Standard").trim();
  const cents = employerPlanCents(planType);
  if (cents == null) return { error: "Unknown listing plan." };
  return {
    planType: planType as EmployerPlanName,
    planPrice: employerPlanDollars(cents),
    featured: false,
    adminTest: false,
    startPack: false,
  };
}

export type EmployerCharge = {
  planType: EmployerPlanName;
  unitAmountCents: number;
  featured: boolean;
  adminTest: boolean;
};

/** Amount Stripe must charge for a stored draft or a renewal. */
export function chargeForStoredJob(input: {
  planType?: string | null;
  planPrice?: number | null;
  renew?: boolean;
}): EmployerCharge | { error: string } {
  if (input.renew) {
    return {
      planType: "Standard",
      unitAmountCents: EMPLOYER_PLAN_CENTS.Standard,
      featured: false,
      adminTest: false,
    };
  }
  if (input.planPrice === 0) return { error: "Start pack listings skip checkout." };
  if (input.planPrice === 1) {
    return { planType: "Standard", unitAmountCents: 100, featured: false, adminTest: true };
  }
  const cents = employerPlanCents(input.planType);
  if (cents == null) return { error: "Unknown listing plan." };
  if (typeof input.planPrice === "number" && Math.round(input.planPrice * 100) !== cents) {
    return { error: "Listing price does not match the selected plan." };
  }
  return {
    planType: input.planType as EmployerPlanName,
    unitAmountCents: cents,
    featured: false,
    adminTest: false,
  };
}

export function paidCheckoutMatches(input: {
  paymentStatus?: string | null;
  currency?: string | null;
  amountTotal?: number | null;
  expectedCents: number;
}): boolean {
  if (input.paymentStatus !== "paid") return false;
  if ((input.currency || "").toLowerCase() !== "usd") return false;
  return input.amountTotal === input.expectedCents;
}

type EmployerJobState = {
  status?: string | null;
  stripe_payment_status?: string | null;
  stripe_session_id?: string | null;
  plan_type?: string | null;
  plan_price?: number | null;
};

/** Webhook patch. Never sets status to published. */
export function employerCheckoutPatch(input: {
  job: EmployerJobState;
  sessionId: string;
  paymentStatus?: string | null;
  currency?: string | null;
  amountTotal?: number | null;
  expectedCents: number;
  planType: string;
}): { update: Record<string, unknown>; audit: string } | { ignore: true } {
  const alreadyApplied =
    input.job.stripe_session_id === input.sessionId && input.job.stripe_payment_status === "paid";
  if (alreadyApplied) return { ignore: true };

  const paid = paidCheckoutMatches({
    paymentStatus: input.paymentStatus,
    currency: input.currency,
    amountTotal: input.amountTotal,
    expectedCents: input.expectedCents,
  });
  if (!paid) {
    if (input.job.status === "published" || input.job.stripe_payment_status === "paid") return { ignore: true };
    return {
      audit: "payment_incomplete",
      update: {
        stripe_payment_status: "unpaid",
        stripe_session_id: input.sessionId,
      },
    };
  }

  const dollars = employerPlanDollars(input.expectedCents);
  return {
    audit: "payment_received",
    update: {
      status: "pending_review",
      stripe_payment_status: "paid",
      stripe_session_id: input.sessionId,
      plan_type: input.planType,
      plan_price: dollars,
      plan_currency: "USD",
      is_featured: featuredForPaidPlan(input.planType, input.expectedCents),
      posted_at_text: "Pending review",
      published_at: null,
      unpublished_at: null,
    },
  };
}

export function employerRefundPatch(job: EmployerJobState): Record<string, unknown> {
  const live = job.status === "published" || job.status === "pending_review";
  const update: Record<string, unknown> = {
    stripe_payment_status: "refunded",
    is_featured: false,
  };
  if (live) {
    update.status = "archived";
    update.posted_at_text = "Expired";
    update.unpublished_at = new Date().toISOString();
  }
  return update;
}

export function adminCanApproveListing(job: EmployerJobState): boolean {
  const price = typeof job.plan_price === "number" ? job.plan_price : null;
  const payment = job.stripe_payment_status || "";
  if (price === 0 && payment === "founding") return true;
  if (price === 1 && payment === "paid") return true;
  if (payment !== "paid" || price == null || !isEmployerPlanName(job.plan_type)) return false;
  return Math.round(price * 100) === employerPlanCents(job.plan_type);
}

export function paidListingReadyToExpire(
  job: EmployerJobState & { published_at?: string | null; origin?: string | null },
  now = Date.now(),
  days = EMPLOYER_PLAN_DAYS,
): boolean {
  if (job.status !== "published") return false;
  if (isSourcedJobOrigin(job.origin)) return false;
  const paid = job.stripe_payment_status === "paid" || (typeof job.plan_price === "number" && job.plan_price > 0);
  if (!paid) return false;
  if (!job.published_at) return false;
  const publishedAt = Date.parse(job.published_at);
  if (!Number.isFinite(publishedAt)) return false;
  return now - publishedAt >= days * 24 * 60 * 60 * 1000;
}
