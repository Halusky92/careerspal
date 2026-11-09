import assert from "node:assert/strict";
import test from "node:test";
import { stripeWebhookSecrets } from "./stripeWebhookInbox";

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
