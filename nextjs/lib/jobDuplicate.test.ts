import assert from "node:assert/strict";
import test from "node:test";
import { canonicalApplyUrl, classifyJobDuplicate, sourcingMayOverwrite } from "./jobDuplicate";

test("the same apply URL is one card even when the query string differs", () => {
  const decision = classifyJobDuplicate(
    { applyUrl: "https://jobs.ashbyhq.com/clipboard/abc/?utm_source=board", title: "Ops Lead", companyId: "clip" },
    [{ id: "job-1", applyUrl: "https://jobs.ashbyhq.com/clipboard/abc", title: "Ops Lead", companyId: "clip" }],
  );
  assert.equal(decision.action, "block");
  assert.equal(canonicalApplyUrl("https://jobs.ashbyhq.com/clipboard/abc/"), "jobs.ashbyhq.com/clipboard/abc");
});

test("a shared Greenhouse form stays separate when the job id differs", () => {
  const decision = classifyJobDuplicate(
    { applyUrl: "https://stripe.com/jobs/search?gh_jid=2&utm_source=board", title: "Billing Operations", companyId: "stripe" },
    [{ id: "job-1", applyUrl: "https://stripe.com/jobs/search?gh_jid=1", title: "Payments Operations", companyId: "stripe" }],
  );
  assert.equal(decision.action, "create");
  assert.notEqual(
    canonicalApplyUrl("https://stripe.com/jobs/search?gh_jid=1"),
    canonicalApplyUrl("https://stripe.com/jobs/search?gh_jid=2"),
  );
});

test("the same title at the same company needs review instead of a second card", () => {
  const decision = classifyJobDuplicate(
    { applyUrl: "https://stripe.com/jobs/ops-2", title: "Revenue Operations Manager", location: "Remote", companyId: "stripe" },
    [{ id: "job-1", applyUrl: "https://stripe.com/jobs/ops-1", title: "Revenue Operations Manager", location: "Remote", companyId: "stripe" }],
  );
  assert.equal(decision.action, "review");
});

test("a different company with the same title can be created", () => {
  const decision = classifyJobDuplicate(
    { applyUrl: "https://other.example/jobs/1", title: "Revenue Operations Manager", companyId: "other" },
    [{ id: "job-1", applyUrl: "https://stripe.com/jobs/1", title: "Revenue Operations Manager", companyId: "stripe" }],
  );
  assert.equal(decision.action, "create");
});

test("sourcing does not overwrite a paid or employer-owned job", () => {
  assert.equal(sourcingMayOverwrite({ origin: "employer", planPrice: 79, stripePaymentStatus: "paid" }), false);
  assert.equal(sourcingMayOverwrite({ origin: "greenhouse", planPrice: null, stripePaymentStatus: null }), true);
  assert.equal(sourcingMayOverwrite({ origin: null, planPrice: 79, stripePaymentStatus: null }), false);
  assert.equal(sourcingMayOverwrite({ origin: "ashby", planPrice: null, stripePaymentStatus: null }), true);
});
