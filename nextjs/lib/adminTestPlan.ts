export const ADMIN_TEST_PRICE = 1;

const extraAllowList = () =>
  (process.env.ADMIN_TEST_EMAILS || "mb.bilek@gmail.com")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

export function isAdminTestPrice(price?: number | null) {
  return Number(price) === ADMIN_TEST_PRICE;
}

export function canUseAdminTestPlan(input: { role?: string | null; email?: string | null }) {
  if ((input.role || "") === "admin") return true;
  const email = (input.email || "").trim().toLowerCase();
  return Boolean(email && extraAllowList().includes(email));
}

export function adminTestPlanLabel(price?: number | null) {
  if (isAdminTestPrice(price)) return "Admin Stripe test ($1)";
  return null;
}
