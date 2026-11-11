import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { employerCheckoutPatch, employerRefundPatch } from "./employerPlans";
import { runStripeEventOnce, stripeWebhookSecrets } from "./stripeWebhookInbox";

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
