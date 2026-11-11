import assert from "node:assert/strict";
import test from "node:test";
import {
  applyBoardVisibility,
  boardCap,
  boardCapsEnabled,
  GUEST_VISIBLE_JOBS,
  jobVisibleAtRank,
  boardPageForTier,
  paginateBoardJobs,
  premiumCheckoutAllowed,
  premiumCheckoutOpen,
  premiumLiveBuyerAllowed,
  premiumPriceIsMonthly799,
  resolvePremiumStripeKey,
  stripeKeyForEventMode,
  REGISTERED_VISIBLE_JOBS,
  resolveBoardTier,
} from "./boardAccess";

test("guest sees 4, registered 14, paid unlimited", () => {
  assert.equal(boardCap("guest"), GUEST_VISIBLE_JOBS);
  assert.equal(boardCap("registered"), REGISTERED_VISIBLE_JOBS);
  assert.equal(boardCap("paid"), null);
});

test("admin and active premium are paid", () => {
  assert.equal(resolveBoardTier({ signedIn: true, role: "admin" }), "paid");
  assert.equal(resolveBoardTier({ signedIn: true, premiumUntil: "2099-01-01T00:00:00.000Z" }), "paid");
  assert.equal(resolveBoardTier({ signedIn: true, premiumUntil: "2000-01-01T00:00:00.000Z" }), "registered");
  assert.equal(resolveBoardTier({ signedIn: false }), "guest");
});

test("visibility keeps the newest jobs", () => {
  const jobs = [
    { id: "a", timestamp: 1 },
    { id: "b", timestamp: 3 },
    { id: "c", timestamp: 2 },
  ];
  assert.deepEqual(
    applyBoardVisibility(jobs, 2).map((job) => job.id),
    ["b", "c"],
  );
  assert.equal(jobVisibleAtRank(0, 4), true);
  assert.equal(jobVisibleAtRank(4, 4), false);
  assert.equal(jobVisibleAtRank(4, null), true);
});

test("API pagination never leaks past guest/member caps even with skip", () => {
  const jobs = Array.from({ length: 20 }, (_, i) => ({ id: String(i), timestamp: 20 - i }));
  const guest = paginateBoardJobs(jobs, { cap: 4, skip: 10, limit: 100 });
  assert.equal(guest.total, 20);
  assert.equal(guest.jobs.length, 4);
  assert.deepEqual(
    guest.jobs.map((job) => job.id),
    ["0", "1", "2", "3"],
  );
  const paid = paginateBoardJobs(jobs, { cap: null, skip: 4, limit: 3 });
  assert.equal(paid.total, 20);
  assert.deepEqual(
    paid.jobs.map((job) => job.id),
    ["4", "5", "6"],
  );
  const member = boardPageForTier(jobs, "registered", { skip: 10, limit: 100 });
  assert.equal(member.access, "registered");
  assert.equal(member.jobs.length, REGISTERED_VISIBLE_JOBS);
  const unlimited = boardPageForTier(jobs, "paid", { skip: 14, limit: 3 });
  assert.equal(unlimited.access, "paid");
  assert.deepEqual(
    unlimited.jobs.map((job) => job.id),
    ["14", "15", "16"],
  );
});

test("search caps stay off until enabled, and Premium checkout rejects a live key", () => {
  assert.equal(boardCapsEnabled(undefined), false);
  assert.equal(boardCapsEnabled(""), false);
  assert.equal(boardCapsEnabled("1"), true);
  assert.equal(premiumCheckoutAllowed("sk_test_123"), true);
  assert.equal(premiumCheckoutAllowed("sk_live_123"), false);
  assert.equal(premiumCheckoutAllowed(""), false);
  assert.equal(premiumCheckoutOpen(undefined, "sk_test_123", ""), false);
  assert.equal(premiumCheckoutOpen("1", "sk_live_123", ""), false);
  assert.equal(premiumCheckoutOpen("1", "sk_live_123", "1"), true);
  assert.equal(premiumCheckoutOpen("1", "sk_test_123", ""), true);
  assert.equal(premiumLiveBuyerAllowed("person@example.com", "sk_live_123", ""), false);
  assert.equal(premiumLiveBuyerAllowed("other@example.com", "sk_live_123", "person@example.com"), false);
  assert.equal(premiumLiveBuyerAllowed("Person@example.com", "sk_live_123", "person@example.com"), true);
  assert.equal(premiumLiveBuyerAllowed("anyone@example.com", "sk_test_123", ""), true);
  assert.equal(resolvePremiumStripeKey({ STRIPE_SECRET_KEY: "sk_live_employer", PREMIUM_LIVE: "" }), "");
  assert.equal(resolvePremiumStripeKey({ STRIPE_SECRET_KEY: "sk_test_shared", PREMIUM_LIVE: "" }), "sk_test_shared");
  assert.equal(
    resolvePremiumStripeKey({
      STRIPE_SECRET_KEY: "sk_live_employer",
      STRIPE_PREMIUM_SECRET_KEY: "sk_live_premium",
      PREMIUM_LIVE: "1",
    }),
    "sk_live_premium",
  );
  assert.equal(stripeKeyForEventMode(false, { STRIPE_SECRET_KEY: "sk_live_employer", STRIPE_PREMIUM_SECRET_KEY: "sk_live_premium" }), "sk_live_employer");
  assert.equal(stripeKeyForEventMode(true, { STRIPE_SECRET_KEY: "sk_live_employer", STRIPE_PREMIUM_SECRET_KEY: "sk_live_premium" }), "sk_live_premium");
  assert.equal(premiumPriceIsMonthly799({ unit_amount: 799, currency: "usd", active: true, recurring: { interval: "month" } }), true);
  assert.equal(premiumPriceIsMonthly799({ unit_amount: 800, currency: "usd", active: true, recurring: { interval: "month" } }), false);
});
