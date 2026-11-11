import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyBoardSubscription, premiumProfilePatch, subscriptionGrantsPremium } from "./stripeBoardPremium";
import { resolveBoardTier } from "./boardAccess";
import { runStripeEventOnce } from "./stripeWebhookInbox";

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

test("an unknown subscription does not grant Premium", () => {
  assert.equal(subscriptionGrantsPremium({ purpose: "board_access", subscriptionId: "sub_new" }), true);
  assert.equal(subscriptionGrantsPremium({ purpose: "", subscriptionId: "sub_new", storedSubscriptionId: "sub_new" }), true);
  assert.equal(subscriptionGrantsPremium({ purpose: "employer_listing", subscriptionId: "sub_other", storedSubscriptionId: "sub_new" }), false);
  assert.equal(subscriptionGrantsPremium({ purpose: "", subscriptionId: "sub_other" }), false);
});

test("past_due unpaid invoice still keeps Premium (grace)", () => {
  const patch = premiumProfilePatch({ subscription: sub("past_due"), currentUntil: untilIso });
  assert.equal(patch.board_premium_until, untilIso);
});

test("a failed renewal does not extend the already paid period", () => {
  const later = periodEnd + 30 * 24 * 3600;
  const failed = premiumProfilePatch({
    subscription: sub("past_due", { current_period_end: later }),
    currentUntil: untilIso,
  });
  assert.equal(failed.board_premium_until, untilIso);
  const unpaidActive = premiumProfilePatch({
    subscription: sub("active", { current_period_end: later }),
    currentUntil: untilIso,
  });
  assert.equal(unpaidActive.board_premium_until, untilIso);
  const paid = premiumProfilePatch({
    subscription: sub("active", { current_period_end: later }),
    currentUntil: untilIso,
    allowExtend: true,
  });
  assert.equal(paid.board_premium_until, new Date(later * 1000).toISOString());
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

test("a late older snapshot does not shorten a newer paid period", () => {
  const newer = new Date((periodEnd + 30 * 24 * 3600) * 1000).toISOString();
  const lateUnpaid = premiumProfilePatch({
    subscription: sub("unpaid"),
    currentUntil: newer,
  });
  assert.equal(lateUnpaid.board_premium_until, newer);
  const lateActive = premiumProfilePatch({
    subscription: sub("active"),
    currentUntil: newer,
  });
  assert.equal(lateActive.board_premium_until, newer);
});

test("an unpaid invoice for the current period removes Premium", () => {
  const patch = premiumProfilePatch({
    subscription: sub("unpaid"),
    currentUntil: untilIso,
  });
  assert.equal(patch.board_premium_until, null);
  assert.equal(resolveBoardTier({ signedIn: true, premiumUntil: patch.board_premium_until }), "registered");
});

test("a failed Premium write can retry, then a duplicate does not apply it again", async () => {
  const rows: Array<{ event_id: string; event_type: string; received_at: string }> = [];
  const match = (filters: Array<[string, string]>) =>
    rows.filter((row) => filters.every(([key, value]) => row[key as keyof typeof row] === value));
  const chain = (apply: (filters: Array<[string, string]>) => void) => {
    const filters: Array<[string, string]> = [];
    const builder = {
      eq(column: string, value: string) {
        filters.push([column, value]);
        return builder;
      },
      then(resolve: (value: { error: null }) => unknown) {
        apply(filters);
        return Promise.resolve({ error: null }).then(resolve);
      },
    };
    return builder;
  };
  const inbox = {
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
          return {
            eq(column: string, value: string) {
              filters.push([column, value]);
              return this;
            },
            maybeSingle() {
              return Promise.resolve({ data: match(filters)[0] || null, error: null });
            },
          };
        },
        update(patch: { event_type?: string }) {
          return chain((filters) => {
            for (const row of match(filters)) Object.assign(row, patch);
          });
        },
        delete() {
          return chain((filters) => {
            for (let index = rows.length - 1; index >= 0; index -= 1) {
              const row = rows[index];
              if (filters.every(([key, value]) => row[key as keyof typeof row] === value)) rows.splice(index, 1);
            }
          });
        },
      };
    },
  };
  const profile = { board_premium_until: null as string | null, writes: 0 };
  let failWrite = true;
  const profiles = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({ data: { board_premium_until: profile.board_premium_until }, error: null }),
              };
            },
          };
        },
        update(patch: { board_premium_until?: string | null }) {
          return {
            eq() {
              return {
                select: async () => {
                  profile.writes += 1;
                  if (failWrite) return { data: null, error: { message: "premium update failed" } };
                  profile.board_premium_until = patch.board_premium_until || null;
                  return { data: [{ id: "profile_1" }], error: null };
                },
              };
            },
          };
        },
      };
    },
  };
  const event = { id: "evt_premium", type: "checkout.session.completed" };
  const work = () =>
    applyBoardSubscription(
      { profileId: "profile_1", subscription: sub("active") as never },
      profiles as never,
    );

  await assert.rejects(
    () => runStripeEventOnce({ sb: inbox as unknown as SupabaseClient, event, work }),
    /premium update failed/,
  );
  assert.equal(profile.board_premium_until, null);
  assert.equal(rows.length, 0);

  failWrite = false;
  assert.equal(await runStripeEventOnce({ sb: inbox as unknown as SupabaseClient, event, work }), "done");
  assert.equal(profile.board_premium_until, untilIso);
  const writesAfterSuccess = profile.writes;

  assert.equal(await runStripeEventOnce({ sb: inbox as unknown as SupabaseClient, event, work }), "duplicate");
  assert.equal(profile.writes, writesAfterSuccess);
  assert.equal(profile.board_premium_until, untilIso);
});
