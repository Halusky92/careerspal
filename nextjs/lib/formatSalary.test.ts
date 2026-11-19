import assert from "node:assert/strict";
import test from "node:test";
import { formatEmployerSalaryForStorage, formatJobSalary, formatSalaryDisplay } from "./formatSalary";

test("employer salary numbers are stored as USD", () => {
  const stored = formatEmployerSalaryForStorage("80000-120000");
  assert.match(stored, /\$80k/);
  assert.match(stored, /\$120k/);
});

test("employer salary already marked in dollars stays dollars", () => {
  const stored = formatEmployerSalaryForStorage("$90k–$110k");
  assert.match(stored, /\$90k/);
});

test("space thousands like 80 000 become $80k", () => {
  const stored = formatEmployerSalaryForStorage("80 000");
  assert.match(stored, /\$80k/);
  assert.equal(stored.includes("$80 a"), false);
});

test("a stored floor uses the range from the job description", () => {
  const shown = formatSalaryDisplay(
    "$64k a year",
    "The base salary range for this role is $64,000 – $80,000 a year.",
  );
  assert.match(shown, /\$64k/);
  assert.match(shown, /\$80k/);
  assert.equal(shown.includes("/ month"), false);
});

test("a long Checkr about section still yields the base salary range", () => {
  const shown = formatSalaryDisplay(
    "$64k a year",
    "Checkr has over 100,000 customers. On-target Earnings OR Base Salary range (Nashville, TN) $64,000 — $80,000 USD What We Offer medical coverage and $25K reimbursement.",
  );
  assert.match(shown, /\$64k/);
  assert.match(shown, /\$80k/);
  assert.match(shown, /a year/);
});

test("a lunch stipend and a home-office amount do not hide the stored salary", () => {
  const shown = formatSalaryDisplay(
    "$135k–$170k a year",
    "A weekly lunch stipend of $75/£75 or equivalent. Everyone receives a $500 home office stipend.",
  );
  assert.match(shown, /\$135k/);
  assert.match(shown, /\$170k/);
  assert.equal(shown, "$135k–$170k a year");
});

test("a dollar range is not shown when the posting also states a Canadian band", () => {
  const shown = formatSalaryDisplay(
    "$109k–$155k a year",
    "United States: $108.5K – $155K base Canada : CA$150.5K - CA$215K base",
  );
  assert.equal(shown, "Salary listed");
});

test("a year marker between two amounts stays one salary range", () => {
  const shown = formatSalaryDisplay(
    "From $180k a year",
    "The typical base pay range for this role across the U.S. is: $180,000/year -$270,000/year + bonus + equity + benefits.",
  );
  assert.match(shown, /\$180k/);
  assert.match(shown, /\$270k/);
  assert.equal(shown.startsWith("From "), false);
});

test("a stored floor without a range is labeled From", () => {
  const shown = formatSalaryDisplay("$95k a year");
  assert.match(shown, /^From \$95k a year$/);
});

test("a Canada role shows the Canadian band instead of the US band", () => {
  const shown = formatSalaryDisplay(
    "$109k–$155k a year",
    "United States: $108.5K – $155K base\nCanada : CA$150.5K\nCA$215K base",
    "Remote Canada",
  );
  assert.match(shown, /CA\$151k/);
  assert.match(shown, /CA\$215k/);
  assert.equal(shown.includes("$109k"), false);
});

test("the same Canada role shows the Canadian band from the card and the detail", () => {
  const job = {
    salary: "$109k–$155k a year",
    location: "Remote",
    remotePolicy: "Remote",
    description: "This role is based in Canada. United States: $108.5K – $155K base. Canada: CA$150.5K – CA$215K base.",
  };
  const shown = formatJobSalary(job);
  assert.match(shown, /CA\$151k/);
  assert.match(shown, /CA\$215k/);
  assert.equal(shown.includes("$109k"), false);
});

test("a stored dollar string yields to SGD named in the posting", () => {
  const shown = formatSalaryDisplay("$239k a year", "The annual base salary for this role is 239,000 SGD.");
  assert.match(shown, /SGD 239k/);
  assert.equal(shown.includes("$"), false);
});

test("Checkr Greenhouse copy is annual even when later benefits mention months", () => {
  const description =
    "On-target Earnings OR Base Salary range (Nashville, TN) $80,000 — $100,000 USD What We Offer A fast-paced environment 100% medical coverage Up to 3 months parental leave and $25K reimbursement.";
  const shown = formatSalaryDisplay("$80k a year", description);
  assert.match(shown, /\$80k/);
  assert.match(shown, /\$100k/);
  assert.match(shown, /a year/);
  assert.equal(shown.includes("/ month"), false);
});
