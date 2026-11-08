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

test("start pack is 1 per account and 1 per company, whichever is tighter", () => {
  const companyJobs = [
    {
      id: "c0",
      created_by: "other",
      company_id: "co-1",
      plan_price: 0,
      stripe_payment_status: "founding",
    },
  ];
  const usage = startPackUsage({ jobs: companyJobs, profileId: "me" });
  assert.equal(usage.accountUsed, 0);
  assert.equal(usage.companyUsed, 1);
  assert.equal(usage.remainingJobs, 0);
  assert.equal(usage.reason, "company_cap");
});

test("one account cannot take more than 1 even at a new company", () => {
  const jobs = [
    {
      id: "a0",
      created_by: "me",
      company_id: "co-new",
      plan_price: 0,
    },
  ];
  const usage = startPackUsage({ jobs, profileId: "me" });
  assert.equal(usage.remainingJobs, 0);
  assert.equal(usage.reason, "account_cap");
});

test("greenhouse rows do not eat the pack", () => {
  assert.equal(isStartPackJob({ id: "1", origin: "greenhouse", plan_price: 0 }), false);
  assert.equal(isStartPackJob({ id: "2", origin: "employer", plan_price: 0 }), true);
});
