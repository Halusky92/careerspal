import assert from "node:assert/strict";
import test from "node:test";
import { premiumReceiptText, sendPremiumReceipt } from "./premiumReceipt";

test("premium confirmation states price, renewal, cancel, and refund", async () => {
  const text = premiumReceiptText("2026-12-11T00:00:00.000Z");
  assert.match(text, /\$7\.99 per month/);
  assert.match(text, /renews automatically/);
  assert.match(text, /end of the paid period/);
  assert.match(text, /refund ends it immediately/);
  assert.match(text, /not a tax invoice/);
  const previous = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  assert.equal(await sendPremiumReceipt({ to: "person@example.com" }), "skipped");
  process.env.RESEND_API_KEY = previous;
});
