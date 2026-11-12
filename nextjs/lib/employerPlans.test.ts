import assert from "node:assert/strict";
import test from "node:test";
import {
  adminCanApproveListing,
  chargeForStoredJob,
  employerCheckoutPatch,
  employerJobIdFromMetadata,
  employerRefundAction,
  employerRefundPatch,
  missingJobsUnpublishedColumn,
  paidListingReadyToExpire,
  resolveEmployerStripeKey,
  resolveStoredEmployerPlan,
  writeEmployerRefund,
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
  const charge = (planType: string, planPrice: number, renew = false) => {
    const result = chargeForStoredJob({ planType, planPrice, renew });
    if ("error" in result) throw new Error(result.error);
    return result.unitAmountCents;
  };
  assert.equal(charge("Standard", 79), 7900);
  assert.equal(charge("Featured Pro", 149), 14900);
  assert.equal(charge("Elite Managed", 249), 24900);
  assert.equal(charge("Elite Managed", 249, true), 7900);
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

test("a partial refund is recorded without closing the listing", () => {
  assert.equal(employerRefundAction({ amount: 7900, amountRefunded: 1000, refunded: false }), "partial");
  assert.equal(employerRefundAction({ amount: 7900, amountRefunded: 7900, refunded: false }), "full");
  assert.equal(employerRefundAction({ amount: 7900, amountRefunded: 0, refunded: true }), "full");
  assert.equal(employerRefundAction({ amount: 7900, amountRefunded: 0, refunded: false }), "none");
});

test("employer live checkout stays closed without its own live key", () => {
  assert.equal(resolveEmployerStripeKey({ STRIPE_SECRET_KEY: "sk_test_employer" }), "sk_test_employer");
  assert.equal(
    resolveEmployerStripeKey({ STRIPE_EMPLOYER_SECRET_KEY: "sk_test_dedicated", STRIPE_SECRET_KEY: "sk_live_shared" }),
    "sk_test_dedicated",
  );
  assert.equal(resolveEmployerStripeKey({ STRIPE_SECRET_KEY: "sk_live_shared" }), "");
  assert.equal(resolveEmployerStripeKey({ STRIPE_SECRET_KEY: "sk_live_shared", EMPLOYER_LIVE: "1" }), "");
  assert.equal(resolveEmployerStripeKey({ STRIPE_EMPLOYER_SECRET_KEY: "sk_live_employer" }), "");
  assert.equal(
    resolveEmployerStripeKey({ STRIPE_EMPLOYER_SECRET_KEY: "sk_test_dedicated", EMPLOYER_LIVE: "1" }),
    "sk_test_dedicated",
  );
  assert.equal(
    resolveEmployerStripeKey({ STRIPE_EMPLOYER_SECRET_KEY: "sk_live_employer", STRIPE_SECRET_KEY: "sk_live_shared", EMPLOYER_LIVE: "1" }),
    "sk_live_employer",
  );
  assert.equal(employerJobIdFromMetadata({ purpose: "employer_listing", jobId: "job_1" }), "job_1");
  assert.equal(employerJobIdFromMetadata({ purpose: "board_access", jobId: "job_1" }), null);
  assert.equal(employerJobIdFromMetadata({ purpose: "employer_listing", jobId: " " }), null);
  assert.equal(missingJobsUnpublishedColumn("Could not find the 'unpublished_at' column of 'jobs' in the schema cache"), true);
  assert.equal(missingJobsUnpublishedColumn("connection reset"), false);
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

test("a partial refund records the original charge and leaves the listing up", async () => {
  const audits: Array<Record<string, unknown>> = [];
  const db = {
    from(table: string) {
      assert.equal(table, "audit_logs");
      return {
        async insert(values: Record<string, unknown>) {
          audits.push(values);
          return { error: null };
        },
      };
    },
  };
  await writeEmployerRefund(db, {
    action: "partial",
    jobId: "job_1",
    chargeId: "ch_1",
    paymentIntentId: "pi_1",
    amount: 7900,
    amountRefunded: 1000,
    job: { status: "published", stripe_payment_status: "paid" },
  });
  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, "employer_listing_partial_refund");
  assert.equal(audits[0].job_id, "job_1");
  assert.deepEqual(audits[0].metadata, {
    chargeId: "ch_1",
    paymentIntentId: "pi_1",
    jobId: "job_1",
    amount: 7900,
    amountRefunded: 1000,
  });
});

test("a full refund drops unpublished_at only when that column is missing", async () => {
  const updates: Array<Record<string, unknown>> = [];
  const db = {
    from(table: string) {
      if (table === "audit_logs") return { async insert() { return { error: null }; } };
      return {
        update(values: Record<string, unknown>) {
          updates.push(values);
          return {
            async eq() {
              if (updates.length === 1) {
                return { error: { message: "Could not find the 'unpublished_at' column of 'jobs' in the schema cache" } };
              }
              return { error: null };
            },
          };
        },
      };
    },
  };
  await writeEmployerRefund(db, {
    action: "full",
    jobId: "job_1",
    chargeId: "ch_1",
    paymentIntentId: "pi_1",
    amount: 7900,
    amountRefunded: 7900,
    job: { status: "published", stripe_payment_status: "paid" },
  });
  assert.equal("unpublished_at" in updates[0], true);
  assert.equal(updates[0].status, "archived");
  assert.equal("unpublished_at" in updates[1], false);
  assert.equal(updates[1].status, "archived");

  const other = {
    from() {
      return {
        update(values: Record<string, unknown>) {
          return { async eq() { return { error: { message: "connection reset" } }; } };
        },
      };
    },
  };
  await assert.rejects(
    () => writeEmployerRefund(other, {
      action: "full",
      jobId: "job_1",
      chargeId: "ch_1",
      paymentIntentId: "pi_1",
      amount: 7900,
      amountRefunded: 7900,
      job: { status: "published" },
    }),
    /connection reset/,
  );
});
