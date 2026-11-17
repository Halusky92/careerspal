import assert from "node:assert/strict";
import test from "node:test";
import { salaryBucketsFromJobs } from "./salaryBoardSummary";

const role = {
  category: "Operations",
  location: "Remote",
  remotePolicy: "Remote",
  description: "",
};

test("salary insights stay in US dollars", () => {
  const buckets = salaryBucketsFromJobs([
    { ...role, salary: "$100k–$120k a year" },
    { ...role, salary: "$140k–$160k a year" },
    { ...role, salary: "$180k–$200k a year" },
    { ...role, salary: "SGD 239k a year", description: "The annual base salary for this role is 239,000 SGD." },
    {
      ...role,
      location: "Remote Canada",
      salary: "$109k–$155k a year",
      description: "United States: $108.5K – $155K base Canada : CA$150.5K - CA$215K base",
    },
  ]);
  assert.equal(buckets.length, 1);
  assert.equal(buckets[0].count, 3);
  assert.equal(buckets[0].min, 110000);
  assert.equal(buckets[0].max, 190000);
});
