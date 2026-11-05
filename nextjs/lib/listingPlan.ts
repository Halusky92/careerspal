import { FOUNDING_JOBS_PER_COMPANY } from "./founding";
import { normalizeCompanyKey } from "./workEmailDomain";
import type { Job } from "../types";

export type ListingPlanKind = "free" | "paid" | "sourced";

export type ListingPlanInfo = {
  kind: ListingPlanKind;
  label: string;
  used?: number;
  quota?: number;
  amount?: number;
};

export function isStartPackListing(job: Pick<Job, "plan" | "stripePaymentStatus" | "origin">) {
  if ((job.origin || "") === "greenhouse") return false;
  if (job.stripePaymentStatus === "founding") return true;
  return job.plan?.price === 0;
}

export function companyPackKey(job: Pick<Job, "id" | "company" | "companyId">) {
  if (job.companyId) return `id:${job.companyId}`;
  const name = normalizeCompanyKey(job.company);
  if (name) return `name:${name}`;
  return `job:${job.id}`;
}

export function countCompanyPackUsage(jobs: Job[]) {
  const used = new Map<string, number>();
  for (const job of jobs) {
    if (!isStartPackListing(job)) continue;
    const key = companyPackKey(job);
    used.set(key, (used.get(key) || 0) + 1);
  }
  return used;
}

export function listingPlanInfo(
  job: Job,
  packUsedByCompany?: Map<string, number>,
  quota = FOUNDING_JOBS_PER_COMPANY,
): ListingPlanInfo | null {
  if ((job.origin || "") === "greenhouse") {
    return { kind: "sourced", label: "Sourced" };
  }
  if (isStartPackListing(job)) {
    const used = Math.min(quota, Math.max(packUsedByCompany?.get(companyPackKey(job)) ?? 1, 1));
    return { kind: "free", label: `Free ${used}/${quota}`, used, quota };
  }
  const amount = typeof job.plan?.price === "number" ? job.plan.price : null;
  if (amount && amount > 0) {
    return { kind: "paid", label: `Paid $${amount}`, amount };
  }
  if (job.stripePaymentStatus === "paid") {
    return { kind: "paid", label: "Paid" };
  }
  return null;
}
