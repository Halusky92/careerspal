import assert from "node:assert/strict";
import test from "node:test";
import {
  applyBoardVisibility,
  boardCap,
  boardCapsEnabled,
  GUEST_VISIBLE_JOBS,
  jobVisibleAtRank,
  lockedBoardPreviews,
  boardCompanyCount,
  boardAccessHeadline,
  homeSeeAllLabel,
  boardPageForTier,
  paginateBoardJobs,
  premiumCheckoutAllowed,
  premiumCheckoutOpen,
  premiumLiveBuyerAllowed,
  premiumPriceIsMonthly799,
  premiumSubscriptionBlocksNewCheckout,
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
  assert.equal(premiumLiveBuyerAllowed("", "sk_live_123"), false);
  assert.equal(premiumLiveBuyerAllowed("person@example.com", "sk_live_123"), true);
  assert.equal(premiumLiveBuyerAllowed("anyone@example.com", "sk_test_123"), true);
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

test("live Premium checkout is open to every signed-in account and blocks a second subscription", () => {
  const key = "sk_live_premium";
  assert.equal(premiumCheckoutOpen("1", key, "1"), true);
  assert.equal(premiumLiveBuyerAllowed(null, key), false);
  assert.equal(premiumLiveBuyerAllowed(undefined, key), false);
  assert.equal(premiumLiveBuyerAllowed("   ", key), false);
  assert.equal(premiumLiveBuyerAllowed("other@example.com", key), true);
  assert.equal(premiumLiveBuyerAllowed("MB.Bilek@gmail.com", key), true);
  assert.equal(premiumSubscriptionBlocksNewCheckout(["canceled"]), false);
  assert.equal(premiumSubscriptionBlocksNewCheckout([null, "incomplete"]), false);
  assert.equal(premiumSubscriptionBlocksNewCheckout(["active"]), true);
  assert.equal(premiumSubscriptionBlocksNewCheckout(["trialing"]), true);
  assert.equal(premiumSubscriptionBlocksNewCheckout(["past_due"]), true);
  assert.equal(premiumPriceIsMonthly799({ unit_amount: 799, currency: "usd", active: true, recurring: { interval: "month" } }), true);
  assert.equal(premiumPriceIsMonthly799({ unit_amount: 799, currency: "eur", active: true, recurring: { interval: "month" } }), false);
  assert.equal(premiumPriceIsMonthly799({ unit_amount: 799, currency: "usd", active: true, recurring: { interval: "year" } }), false);
});

test("locked previews keep titles and drop everything past the cap", () => {
  const jobs = Array.from({ length: 6 }, (_, i) => ({
    id: String(i),
    title: `Role ${i}`,
    company: i < 2 ? "Acme" : `Co ${i}`,
    location: "Remote",
    category: "Operations",
    remotePolicy: "Remote",
    applyUrl: "https://example.com/apply",
    description: "secret",
    timestamp: 10 - i,
  }));
  const locked = lockedBoardPreviews(jobs, 4);
  assert.equal(locked.length, 2);
  assert.deepEqual(locked.map((job) => job.id), ["4", "5"]);
  assert.equal("applyUrl" in locked[0], false);
  assert.equal("description" in locked[0], false);
  assert.equal(lockedBoardPreviews(jobs, null).length, 0);
  assert.equal(boardCompanyCount(jobs), 5);
  assert.equal(boardAccessHeadline("guest", 48, 20), "You're viewing 4 of 48 live jobs from 20 companies");
  assert.equal(boardAccessHeadline("registered", 48, 1), "You're viewing 14 of 48 live jobs from 1 company");
  assert.equal(boardAccessHeadline("paid", 48, 20), "You're viewing all 48 live jobs from 20 companies");
  assert.equal(boardAccessHeadline("guest", 3, 2), "You're viewing all 3 live jobs from 2 companies");
  assert.equal(homeSeeAllLabel(false, 62), "Browse jobs");
  assert.equal(homeSeeAllLabel(true, null), "See all jobs");
  assert.equal(homeSeeAllLabel(true, 1), "See all 1 job");
  assert.equal(homeSeeAllLabel(true, 62), "See all 62 jobs");
});
