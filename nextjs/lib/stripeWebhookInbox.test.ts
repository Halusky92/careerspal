import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { employerCheckoutPatch, employerRefundPatch } from "./employerPlans";
import {
  acceptsResolvedAppEnv,
  acceptsStripeEvent,
  resolveStripeEventAppEnv,
  runStripeEventOnce,
  stripeScopeMetadata,
  stripeWebhookSecrets,
  type StripeScopeReader,
} from "./stripeWebhookInbox";

type EventRow = { event_id: string; event_type: string; received_at: string };

function memoryInbox() {
  const rows: EventRow[] = [];
  const match = (filters: Array<[string, string]>) =>
    rows.filter((row) => filters.every(([key, value]) => row[key as keyof EventRow] === value));

  const sb = {
    from() {
      return {
        insert(row: { event_id: string; event_type: string }) {
          if (rows.some((item) => item.event_id === row.event_id)) {
            return Promise.resolve({ error: { code: "23505", message: "duplicate key" } });
          }
          rows.push({ ...row, received_at: new Date().toISOString() });
          return Promise.resolve({ error: null });
        },
        select() {
          const filters: Array<[string, string]> = [];
          const builder = {
            eq(column: string, value: string) {
              filters.push([column, value]);
              return builder;
            },
            maybeSingle() {
              return Promise.resolve({ data: match(filters)[0] || null, error: null });
            },
          };
          return builder;
        },
        update(patch: Partial<EventRow>) {
          const filters: Array<[string, string]> = [];
          const builder = {
            eq(column: string, value: string) {
              filters.push([column, value]);
              return builder;
            },
            then(resolve: (value: { error: null }) => unknown) {
              for (const row of match(filters)) Object.assign(row, patch);
              return Promise.resolve({ error: null }).then(resolve);
            },
          };
          return builder;
        },
        delete() {
          const filters: Array<[string, string]> = [];
          const builder = {
            eq(column: string, value: string) {
              filters.push([column, value]);
              return builder;
            },
            then(resolve: (value: { error: null }) => unknown) {
              for (let index = rows.length - 1; index >= 0; index -= 1) {
                const row = rows[index];
                if (filters.every(([key, value]) => row[key as keyof EventRow] === value)) rows.splice(index, 1);
              }
              return Promise.resolve({ error: null }).then(resolve);
            },
          };
          return builder;
        },
      };
    },
  };

  return { rows, sb: sb as unknown as SupabaseClient };
}

test("webhook secrets skip empty values", () => {
  const prev = process.env.STRIPE_WEBHOOK_SECRET;
  const prev2 = process.env.STRIPE_WEBHOOK_SECRET_SECOND;
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_a";
  process.env.STRIPE_WEBHOOK_SECRET_SECOND = "";
  assert.deepEqual(stripeWebhookSecrets(), ["whsec_a"]);
  process.env.STRIPE_WEBHOOK_SECRET_SECOND = "whsec_b";
  assert.deepEqual(stripeWebhookSecrets(), ["whsec_a", "whsec_b"]);
  process.env.STRIPE_WEBHOOK_SECRET = prev;
  process.env.STRIPE_WEBHOOK_SECRET_SECOND = prev2;
});

test("a failed checkout or refund write can retry, then a duplicate does not repeat it", async () => {
  const inbox = memoryInbox();
  const job = {
    status: "draft",
    plan_type: "Standard",
    plan_price: 79,
    stripe_payment_status: null as string | null,
    stripe_session_id: null as string | null,
  };
  let failCheckout = true;
  let checkoutApplies = 0;
  const checkout = { id: "evt_pay", type: "checkout.session.completed" };

  const applyCheckout = async () => {
    checkoutApplies += 1;
    if (failCheckout) throw new Error("job update failed");
    const decision = employerCheckoutPatch({
      job,
      sessionId: "cs_test",
      paymentStatus: "paid",
      currency: "usd",
      amountTotal: 7900,
      expectedCents: 7900,
      planType: "Standard",
    });
    if ("update" in decision) Object.assign(job, decision.update);
  };

  await assert.rejects(() => runStripeEventOnce({ sb: inbox.sb, event: checkout, work: applyCheckout }), /job update failed/);
  assert.equal(job.status, "draft");
  assert.equal(job.stripe_payment_status, null);
  assert.equal(inbox.rows.length, 0);

  failCheckout = false;
  assert.equal(await runStripeEventOnce({ sb: inbox.sb, event: checkout, work: applyCheckout }), "done");
  assert.equal(job.status, "pending_review");
  assert.equal(job.stripe_payment_status, "paid");
  assert.equal(inbox.rows[0]?.event_type, "checkout.session.completed");
  const checkoutAppliesAfterSuccess = checkoutApplies;

  assert.equal(await runStripeEventOnce({ sb: inbox.sb, event: checkout, work: applyCheckout }), "duplicate");
  assert.equal(checkoutApplies, checkoutAppliesAfterSuccess);
  assert.equal(job.status, "pending_review");

  const refundJob = { status: "published", stripe_payment_status: "paid", is_featured: true };
  let failRefund = true;
  let refundApplies = 0;
  const refund = { id: "evt_refund", type: "charge.refunded" };
  const applyRefund = async () => {
    refundApplies += 1;
    if (failRefund) throw new Error("refund update failed");
    Object.assign(refundJob, employerRefundPatch(refundJob));
  };

  await assert.rejects(() => runStripeEventOnce({ sb: inbox.sb, event: refund, work: applyRefund }), /refund update failed/);
  assert.equal(refundJob.status, "published");
  assert.equal(refundJob.is_featured, true);
  assert.equal(inbox.rows.some((row) => row.event_id === "evt_refund"), false);

  failRefund = false;
  assert.equal(await runStripeEventOnce({ sb: inbox.sb, event: refund, work: applyRefund }), "done");
  assert.equal(refundJob.status, "archived");
  assert.equal(refundJob.stripe_payment_status, "refunded");
  assert.equal(refundJob.is_featured, false);
  const refundAppliesAfterSuccess = refundApplies;

  assert.equal(await runStripeEventOnce({ sb: inbox.sb, event: refund, work: applyRefund }), "duplicate");
  assert.equal(refundApplies, refundAppliesAfterSuccess);
  assert.equal(refundJob.status, "archived");
});

test("staging events are ignored by production and production events are ignored by staging", () => {
  const stagingCheckout = {
    data: { object: { metadata: stripeScopeMetadata({ purpose: "board_access" }, "1") } },
  };
  const productionCheckout = {
    data: { object: { metadata: stripeScopeMetadata({ purpose: "employer_listing" }, "0") } },
  };
  const untagged = { data: { object: { metadata: { purpose: "employer_listing" } } } };
  const stagingInvoice = {
    data: { object: { parent: { subscription_details: { metadata: { app_env: "staging" } } } } },
  };
  assert.equal(acceptsStripeEvent(stagingCheckout, "production"), false);
  assert.equal(acceptsStripeEvent(stagingInvoice, "production"), false);
  assert.equal(acceptsStripeEvent(productionCheckout, "production"), true);
  assert.equal(acceptsStripeEvent(untagged, "production"), true);
  assert.equal(acceptsStripeEvent(stagingCheckout, "staging"), true);
  assert.equal(acceptsStripeEvent(productionCheckout, "staging"), false);
  assert.equal(acceptsStripeEvent(untagged, "staging"), false);
});

test("premium events without metadata still resolve staging from the related subscription", async () => {
  const stagingSub = async () => ({ metadata: { app_env: "staging", purpose: "board_access" } });
  const reader: StripeScopeReader = {
    subscriptions: { retrieve: stagingSub },
    paymentIntents: { retrieve: async () => ({ metadata: {} }) },
    invoices: {
      retrieve: async () => ({ parent: { subscription_details: { subscription: "sub_staging" } } }),
    },
    invoicePayments: { list: async () => ({ data: [{ invoice: "in_staging" }] }) },
  };
  const cases = [
    { type: "checkout.session.completed", data: { object: { subscription: "sub_staging" } } },
    { type: "customer.subscription.updated", data: { object: { metadata: { app_env: "staging" } } } },
    { type: "customer.subscription.deleted", data: { object: { metadata: { app_env: "staging" } } } },
    { type: "invoice.paid", data: { object: { subscription: "sub_staging" } } },
    { type: "invoice.payment_failed", data: { object: { parent: { subscription_details: { subscription: "sub_staging" } } } } },
    { type: "charge.refunded", data: { object: { payment_intent: "pi_staging" } } },
  ];
  for (const event of cases) {
    const tagged = await resolveStripeEventAppEnv(reader, event);
    assert.equal(tagged, "staging", event.type);
    assert.equal(acceptsResolvedAppEnv(tagged, "production"), false);
    assert.equal(acceptsResolvedAppEnv(tagged, "staging"), true);
  }

  const legacyEmployer = await resolveStripeEventAppEnv(
    {
      ...reader,
      paymentIntents: { retrieve: async () => ({ metadata: { purpose: "employer_listing" } }) },
      invoicePayments: { list: async () => ({ data: [] }) },
    },
    { type: "charge.refunded", data: { object: { payment_intent: "pi_employer" } } },
  );
  assert.equal(legacyEmployer, null);
  assert.equal(acceptsResolvedAppEnv(legacyEmployer, "production"), true);

  const legacySubscription = await resolveStripeEventAppEnv(reader, {
    type: "customer.subscription.updated",
    data: { object: { metadata: {} } },
  });
  assert.equal(legacySubscription, null);
  assert.equal(acceptsResolvedAppEnv(legacySubscription, "production"), true);
  assert.equal(acceptsResolvedAppEnv(legacySubscription, "staging"), false);

  await assert.rejects(
    () =>
      resolveStripeEventAppEnv(
        { ...reader, subscriptions: { retrieve: async () => { throw new Error("subscription lookup failed"); } } },
        { type: "invoice.paid", data: { object: { subscription: "sub_staging" } } },
      ),
    /subscription lookup failed/,
  );
});
