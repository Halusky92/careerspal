import { FOUNDING_JOBS_PER_COMPANY } from "./founding";

export type StartPackJobRow = {
  id: string;
  created_by?: string | null;
  company_id?: string | null;
  origin?: string | null;
  plan_price?: number | null;
  stripe_payment_status?: string | null;
};

export function isStartPackJob(job: StartPackJobRow) {
  if ((job.origin || "employer") === "greenhouse") return false;
  return job.plan_price === 0 || job.stripe_payment_status === "founding";
}

export function startPackUsage(args: {
  jobs: StartPackJobRow[];
  profileId: string;
  quota?: number;
}) {
  const quota = args.quota ?? FOUNDING_JOBS_PER_COMPANY;
  const pack = args.jobs.filter(isStartPackJob);
  const ids = new Set(pack.map((job) => job.id));
  const accountIds = new Set(pack.filter((job) => job.created_by === args.profileId).map((job) => job.id));
  const companyUsed = ids.size;
  const accountUsed = accountIds.size;
  const remainingJobs = Math.max(0, Math.min(quota - accountUsed, quota - companyUsed));
  const usedJobs = quota - remainingJobs;
  const reason =
    accountUsed >= quota ? "account_cap" : companyUsed >= quota ? "company_cap" : "open";
  return { accountUsed, companyUsed, usedJobs, remainingJobs, quota, reason };
}
