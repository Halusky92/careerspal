import assert from "node:assert/strict";
import test from "node:test";
import { prepareDecision } from "./decision";
import { chooseOfficialSalary } from "../normalization/salary";

test("an unconfirmed currency stays in review at the current auto-publish threshold", () => {
  const salary = chooseOfficialSalary("$108,500 - $155,000 a year", "Remote - United States");
  assert.equal(salary.salary_present, false);
  const decision = prepareDecision({
    score_total: 95,
    reasons: [],
    salary_present: salary.salary_present,
    duplicate_confidence: "none",
  });
  assert.equal(decision.decision, "manual_review_candidate");
});

test("two salary bands stay in review without lowering the score gate", () => {
  const salary = chooseOfficialSalary("USA: $108,500 - $155,000 USD a year. Canada: $150,500 - $215,000 CAD a year.");
  assert.equal(salary.salary_present, false);
  const decision = prepareDecision({
    score_total: 96,
    reasons: [],
    salary_present: salary.salary_present,
    duplicate_confidence: "none",
  });
  assert.equal(decision.decision, "manual_review_candidate");
});

test("a confirmed salary can still auto-publish at the existing threshold", () => {
  const salary = chooseOfficialSalary("Base salary $108,500 - $155,000 USD a year");
  assert.equal(salary.salary_present, true);
  const decision = prepareDecision({
    score_total: 85,
    reasons: [],
    salary_present: salary.salary_present,
    duplicate_confidence: "none",
  });
  assert.equal(decision.decision, "auto_publish_candidate");
  const below = prepareDecision({
    score_total: 84,
    reasons: [],
    salary_present: true,
    duplicate_confidence: "none",
  });
  assert.equal(below.decision, "manual_review_candidate");
});
