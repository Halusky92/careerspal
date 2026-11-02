export const FOUNDING_COMPANY_CAP = 20;
export const FOUNDING_JOBS_PER_COMPANY = 5;
export const FOUNDING_DAYS = 90;

export function isFoundingLaunchEnabled() {
  return process.env.FOUNDING_LAUNCH !== "0";
}

export function foundingExpiresAt(from = new Date()) {
  return new Date(from.getTime() + FOUNDING_DAYS * 24 * 60 * 60 * 1000).toISOString();
}
