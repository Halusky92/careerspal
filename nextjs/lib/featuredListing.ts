import type { Job, PlanType } from "../types";

export const FEATURED_PLANS: PlanType[] = ["Featured Pro", "Elite Managed"];

export const isPaidFeaturedListing = (job: Pick<Job, "planType" | "plan"> | { planType?: string | null }) => {
  const plan = (job as Job).planType || (job as Job).plan?.type;
  return plan === "Featured Pro" || plan === "Elite Managed";
};

export const featuredRank = (job: Pick<Job, "planType" | "plan">) => {
  const plan = job.planType || job.plan?.type;
  if (plan === "Elite Managed") return 2;
  if (plan === "Featured Pro") return 1;
  return 0;
};

export const featuredLabel = (job: Pick<Job, "planType" | "plan">) => {
  const plan = job.planType || job.plan?.type;
  if (plan === "Elite Managed") return "Elite";
  if (plan === "Featured Pro") return "Pro";
  return null;
};

export const sortFeaturedJobs = (jobs: Job[]) =>
  [...jobs].sort((a, b) => {
    const rank = featuredRank(b) - featuredRank(a);
    if (rank !== 0) return rank;
    return (b.timestamp ?? 0) - (a.timestamp ?? 0);
  });
