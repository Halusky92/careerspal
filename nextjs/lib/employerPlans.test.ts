import assert from "node:assert/strict";
import test from "node:test";
import {
  adminCanApproveListing,
  chargeForStoredJob,
  employerCheckoutPatch,
  employerRefundPatch,
  paidListingReadyToExpire,
  resolveStoredEmployerPlan,
} from "./employerPlans";

test("client price cannot choose the catalog amount", () => {
  const stored = resolveStoredEmployerPlan({ requestedType: "Featured Pro" });
  assert.equal("error" in stored, false);
  if ("error" in stored) return;
  assert.equal(stored.planPrice, 149);
  assert.equal(stored.featured, false);
  const charge = chargeForStoredJob({ planType: stored.planType, planPrice: 6 });
  assert.deepEqual(charge, { error: "Listing price does not match the selected plan." });
});

test("catalog charges are 79, 149, and 249", () => {
  assert.equal(chargeForStoredJob({ planType: "Standard", planPrice: 79 }).unitAmountCents, 7900);
  assert.equal(chargeForStoredJob({ planType: "Featured Pro", planPrice: 149 }).unitAmountCents, 14900);
  assert.equal(chargeForStoredJob({ planType: "Elite Managed", planPrice: 249 }).unitAmountCents, 24900);
  assert.equal(chargeForStoredJob({ planType: "Elite Managed", planPrice: 249, renew: true }).unitAmountCents, 7900);
});

test("a paid webhook waits for admin and does not publish", () => {
  const result = employerCheckoutPatch({
    job: { status: "draft" },
    sessionId: "cs_test",
    paymentStatus: "paid",
    currency: "usd",
    amountTotal: 14900,
    expectedCents: 14900,
    planType: "Featured Pro",
  });
  assert.equal("update" in result, true);
  if (!("update" in result)) return;
  assert.equal(result.update.status, "pending_review");
  assert.equal(result.update.stripe_payment_status, "paid");
  assert.equal(result.update.is_featured, true);
  assert.equal(result.update.published_at, null);
  assert.equal(result.audit, "payment_received");
});

test("a manipulated webhook amount does not mark the job paid", () => {
  const result = employerCheckoutPatch({
    job: { status: "draft" },
    sessionId: "cs_bad",
    paymentStatus: "paid",
    currency: "usd",
    amountTotal: 100,
    expectedCents: 7900,
    planType: "Standard",
  });
  assert.equal("update" in result, true);
  if (!("update" in result)) return;
  assert.equal(result.update.stripe_payment_status, "unpaid");
  assert.equal(result.update.status, undefined);
  assert.equal(result.audit, "payment_incomplete");
});

test("unpaid and duplicate sessions do not publish", () => {
  const unpaid = employerCheckoutPatch({
    job: { status: "draft" },
    sessionId: "cs_open",
    paymentStatus: "unpaid",
    currency: "usd",
    amountTotal: 7900,
    expectedCents: 7900,
    planType: "Standard",
  });
  assert.equal("update" in unpaid && unpaid.update.status, undefined);
  const late = employerCheckoutPatch({
    job: { status: "published", stripe_payment_status: "paid", stripe_session_id: "cs_done" },
    sessionId: "cs_done",
    paymentStatus: "paid",
    currency: "usd",
    amountTotal: 7900,
    expectedCents: 7900,
    planType: "Standard",
  });
  assert.deepEqual(late, { ignore: true });
});

test("admin approval requires a verified payment, founding pack, or admin test", () => {
  assert.equal(adminCanApproveListing({ stripe_payment_status: "paid", plan_type: "Standard", plan_price: 79 }), true);
  assert.equal(adminCanApproveListing({ stripe_payment_status: "paid", plan_type: "Featured Pro", plan_price: 0 }), false);
  assert.equal(adminCanApproveListing({ stripe_payment_status: null, plan_type: "Standard", plan_price: 79 }), false);
  assert.equal(adminCanApproveListing({ stripe_payment_status: "founding", plan_type: "Standard", plan_price: 0 }), true);
  assert.equal(adminCanApproveListing({ stripe_payment_status: "paid", plan_type: "Standard", plan_price: 1 }), true);
});

test("a paid listing expires 30 days after the approval timestamp", () => {
  const now = Date.parse("2026-11-11T00:00:00.000Z");
  const fresh = new Date(now - 29 * 24 * 60 * 60 * 1000).toISOString();
  const old = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(
    paidListingReadyToExpire({ status: "published", stripe_payment_status: "paid", plan_price: 79, published_at: old }, now),
    true,
  );
  assert.equal(
    paidListingReadyToExpire({ status: "published", stripe_payment_status: "paid", plan_price: 79, published_at: fresh }, now),
    false,
  );
  assert.equal(
    paidListingReadyToExpire({ status: "paused", stripe_payment_status: "paid", plan_price: 0, published_at: old }, now),
    false,
  );
});

test("a refund removes a live listing and its featured flag", () => {
  const patch = employerRefundPatch({ status: "published", stripe_payment_status: "paid" });
  assert.equal(patch.status, "archived");
  assert.equal(patch.stripe_payment_status, "refunded");
  assert.equal(patch.is_featured, false);
  const paused = employerRefundPatch({ status: "paused" });
  assert.equal(paused.status, undefined);
  assert.equal(paused.stripe_payment_status, "refunded");
});
