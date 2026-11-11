import assert from "node:assert/strict";
import test from "node:test";
import { premiumProfilePatch } from "./stripeBoardPremium";
import { resolveBoardTier } from "./boardAccess";

const periodEnd = 1_800_000_000; // 2027-01-15
const untilIso = new Date(periodEnd * 1000).toISOString();

const sub = (status: string, extra: Record<string, unknown> = {}) => ({
  id: "sub_test",
  status,
  customer: "cus_test",
  current_period_end: periodEnd,
  ...extra,
});

test("first payment / active keeps Premium through period end", () => {
  const patch = premiumProfilePatch({ subscription: sub("active") });
  assert.equal(patch.stripe_subscription_status, "active");
  assert.equal(patch.board_premium_until, untilIso);
  assert.equal(resolveBoardTier({ signedIn: true, premiumUntil: patch.board_premium_until }), "paid");
});

test("renewal / invoice.paid with active extends the same period_end field", () => {
  const later = periodEnd + 30 * 24 * 3600;
  const patch = premiumProfilePatch({
    subscription: sub("active", { current_period_end: later }),
  });
  assert.equal(patch.board_premium_until, new Date(later * 1000).toISOString());
});

test("past_due unpaid invoice still keeps Premium (grace)", () => {
  const patch = premiumProfilePatch({ subscription: sub("past_due") });
  assert.equal(patch.board_premium_until, untilIso);
});

test("unpaid / incomplete strips Premium immediately", () => {
  assert.equal(premiumProfilePatch({ subscription: sub("unpaid") }).board_premium_until, null);
  assert.equal(premiumProfilePatch({ subscription: sub("incomplete") }).board_premium_until, null);
});

test("cancel at period end while still active keeps paid window", () => {
  const patch = premiumProfilePatch({
    subscription: sub("active", { cancel_at_period_end: true }),
  });
  assert.equal(patch.stripe_subscription_status, "active");
  assert.equal(patch.board_premium_until, untilIso);
});

test("immediate cancel without refund keeps the paid window", () => {
  const patch = premiumProfilePatch({ subscription: sub("canceled") });
  assert.equal(patch.stripe_subscription_status, "canceled");
  assert.equal(patch.board_premium_until, untilIso);
  assert.equal(resolveBoardTier({ signedIn: true, premiumUntil: patch.board_premium_until }), "paid");
});

test("refunded cancel strips Premium immediately", () => {
  const patch = premiumProfilePatch({ subscription: sub("canceled"), refunded: true });
  assert.equal(patch.board_premium_until, null);
  assert.equal(resolveBoardTier({ signedIn: true, premiumUntil: patch.board_premium_until }), "registered");
});

test("expiration after canceled with no remaining period is registered", () => {
  const patch = premiumProfilePatch({
    subscription: sub("canceled", { current_period_end: Math.floor(Date.now() / 1000) - 60 }),
  });
  assert.equal(patch.board_premium_until, null);
});
