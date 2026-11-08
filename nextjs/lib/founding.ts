import { PLAN_PRICES } from "./plans";

export const FOUNDING_COMPANY_CAP = 20;
export const FOUNDING_JOBS_PER_COMPANY = 1;
export const FOUNDING_LAUNCH_PRICE = 0;
export const FOUNDING_DAYS = 90;
export const START_PACK_NEXT_PRICE = PLAN_PRICES.standard;

export type StartPackStatus = {
  enabled: boolean;
  eligible: boolean;
  remainingSlots: number;
  remainingJobs: number;
  usedJobs: number;
  quota: number;
  nextPrice: number;
  companyId?: string | null;
  reason?: string;
};

export function isFoundingLaunchEnabled() {
  return process.env.FOUNDING_LAUNCH !== "0";
}

export function foundingExpiresAt(from = new Date()) {
  return new Date(from.getTime() + FOUNDING_DAYS * 24 * 60 * 60 * 1000).toISOString();
}
