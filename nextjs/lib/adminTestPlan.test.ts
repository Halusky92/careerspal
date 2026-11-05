import assert from "node:assert/strict";
import test from "node:test";
import { canUseAdminTestPlan, isAdminTestPrice } from "./adminTestPlan";

test("any admin can use the $1 Stripe test", () => {
  assert.equal(canUseAdminTestPlan({ role: "admin", email: "anyone@company.com" }), true);
  assert.equal(canUseAdminTestPlan({ role: "employer", email: "hr@acme.com" }), false);
  assert.equal(isAdminTestPrice(1), true);
  assert.equal(isAdminTestPrice(79), false);
});
