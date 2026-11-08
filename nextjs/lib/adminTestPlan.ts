import { isOwnerAdminEmail } from "./adminAccess";

export const ADMIN_TEST_PRICE = 1;

export function isAdminTestPrice(price?: number | null) {
  return Number(price) === ADMIN_TEST_PRICE;
}

export function canUseAdminTestPlan(input: { role?: string | null; email?: string | null }) {
  return isOwnerAdminEmail(input.email);
}

export function adminTestPlanLabel(price?: number | null) {
  if (isAdminTestPrice(price)) return "Admin Stripe test ($1)";
  return null;
}
