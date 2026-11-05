import assert from "node:assert/strict";
import test from "node:test";
import type { Job } from "../types";
import { companyPackKey, countCompanyPackUsage, isStartPackListing, listingPlanInfo } from "./listingPlan";

const job = (over: Partial<Job>): Job =>
  ({
    id: "1",
    title: "Ops",
    company: "Acme",
    logo: "",
    location: "Remote",
    type: "Full-time",
    salary: "$100k",
    postedAt: "1d",
    category: "Operations",
    description: "Work",
    tags: [],
    remotePolicy: "Remote",
    applyUrl: "https://acme.com/jobs",
    ...over,
  }) as Job;

test("start pack listings are free and share a company counter", () => {
  const a = job({ id: "a", companyId: "co", plan: { type: "Standard", price: 0 }, stripePaymentStatus: "founding" });
  const b = job({ id: "b", companyId: "co", company: "Acme Inc", plan: { type: "Standard", price: 0 } });
  const paid = job({ id: "c", companyId: "co", plan: { type: "Standard", price: 79 }, stripePaymentStatus: "paid" });
  assert.equal(isStartPackListing(a), true);
  assert.equal(isStartPackListing(paid), false);
  assert.equal(companyPackKey(a), companyPackKey(b));
  const used = countCompanyPackUsage([a, b, paid]);
  assert.equal(used.get(companyPackKey(a)), 2);
  assert.equal(listingPlanInfo(a, used)?.label, "Free 2/10");
  assert.equal(listingPlanInfo(paid, used)?.label, "Paid $79");
});

test("greenhouse jobs are sourced, not free pack", () => {
  const sourced = job({ origin: "greenhouse", plan: { type: "Standard", price: 0 } });
  assert.equal(isStartPackListing(sourced), false);
  assert.equal(listingPlanInfo(sourced)?.label, "Sourced");
});
