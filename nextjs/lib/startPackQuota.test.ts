import assert from "node:assert/strict";
import test from "node:test";
import { emailDomain, normalizeCompanyKey, workEmailDomain } from "./workEmailDomain";
import { isStartPackJob, startPackUsage } from "./startPackQuota";

test("work email domain ignores gmail and keeps company mail", () => {
  assert.equal(workEmailDomain("jane@gmail.com"), "");
  assert.equal(workEmailDomain("bob@outlook.com"), "");
  assert.equal(emailDomain("hr@Acme.com"), "acme.com");
  assert.equal(workEmailDomain("hr@Acme.com"), "acme.com");
  assert.equal(workEmailDomain("second@acme.com"), "acme.com");
});

test("company keys collapse Inc and spacing", () => {
  assert.equal(normalizeCompanyKey("Acme Inc."), normalizeCompanyKey("ACME"));
  assert.equal(normalizeCompanyKey("Walk Circuit LLC"), "walkcircuit");
});

test("start pack is 10 per account and 10 per company, whichever is tighter", () => {
  const companyJobs = Array.from({ length: 8 }, (_, i) => ({
    id: `c${i}`,
    created_by: "other",
    company_id: "co-1",
    plan_price: 0,
    stripe_payment_status: "founding",
  }));
  const mine = Array.from({ length: 3 }, (_, i) => ({
    id: `a${i}`,
    created_by: "me",
    company_id: "co-1",
    plan_price: 0,
    stripe_payment_status: "founding",
  }));
  const usage = startPackUsage({ jobs: [...companyJobs, ...mine], profileId: "me" });
  assert.equal(usage.accountUsed, 3);
  assert.equal(usage.companyUsed, 11);
  assert.equal(usage.remainingJobs, 0);
  assert.equal(usage.reason, "company_cap");
});

test("one account cannot take more than 10 even at a new company", () => {
  const jobs = Array.from({ length: 10 }, (_, i) => ({
    id: `a${i}`,
    created_by: "me",
    company_id: "co-new",
    plan_price: 0,
  }));
  const usage = startPackUsage({ jobs, profileId: "me" });
  assert.equal(usage.remainingJobs, 0);
  assert.equal(usage.reason, "account_cap");
});

test("greenhouse rows do not eat the pack", () => {
  assert.equal(isStartPackJob({ id: "1", origin: "greenhouse", plan_price: 0 }), false);
  assert.equal(isStartPackJob({ id: "2", origin: "employer", plan_price: 0 }), true);
});
