import assert from "node:assert/strict";
import test from "node:test";
import { startPackUsage } from "./startPackQuota";
import { mergeStartPackUsage } from "./startPackLedger";

test("ledger usage from a closed email still consumes the start pack", () => {
  const live = startPackUsage({ jobs: [], profileId: "new-account" });
  const merged = mergeStartPackUsage(live, { byEmail: 10, byCompany: 0, byDomain: 0 });
  assert.equal(merged.remainingJobs, 0);
  assert.equal(merged.reason, "account_cap");
});

test("ledger usage from the same company still consumes the start pack", () => {
  const live = startPackUsage({ jobs: [], profileId: "new-account" });
  const merged = mergeStartPackUsage(live, { byEmail: 0, byCompany: 10, byDomain: 0 });
  assert.equal(merged.remainingJobs, 0);
  assert.equal(merged.reason, "company_cap");
});
