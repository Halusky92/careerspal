import assert from "node:assert/strict";
import test from "node:test";
import { chooseOfficialSalary, parseSalaryFromText } from "./salary";

test("a single range keeps both bounds, currency, and year", () => {
  const parsed = chooseOfficialSalary("Base salary £91,400 &mdash; £123,600 GBP per year.");
  assert.equal(parsed.salary_present, true);
  assert.equal(parsed.salary_currency, "GBP");
  assert.equal(parsed.salary_period, "year");
  assert.equal(parsed.salary_amount_min, 91000);
  assert.equal(parsed.salary_amount_max, 124000);
});

test("European thousands keep both euro bounds", () => {
  const parsed = parseSalaryFromText("Ireland Pay Range €93.500 - €126.500 EUR per year");
  assert.equal(parsed.salary_currency, "EUR");
  assert.equal(parsed.salary_period, "year");
  assert.equal(parsed.salary_amount_min, 94000);
  assert.equal(parsed.salary_amount_max, 127000);
});

test("Toast zones, Twilio bands, and Dropbox currencies are not collapsed", () => {
  for (const text of [
    "Zone A $115,000 &mdash; $184,000 USD Zone B $100,000 &mdash; $160,000 USD Zone C $90,000 &mdash; $144,000 USD",
    "Colorado $106,320 - $132,900. New York $112,560 - $140,700.",
    "United Kingdom Pay Range £91,400 - £123,600 GBP. Ireland Pay Range €93.500 - €126.500 EUR.",
  ]) {
    const parsed = chooseOfficialSalary(text);
    assert.equal(parsed.salary_present, false);
    assert.equal(parsed.salary_amount_min, null);
    assert.equal(parsed.salary_amount_max, null);
    assert.ok(parsed.salary_parse_notes.includes("multiple_salary_bands"));
  }
});

test("a dollar sign without a named currency stays unconfirmed", () => {
  const parsed = chooseOfficialSalary("$108,500 - $155,000 a year", "Remote");
  assert.equal(parsed.salary_present, false);
  assert.equal(parsed.salary_currency, null);
  assert.ok(parsed.salary_parse_notes.includes("currency_unconfirmed"));
});

test("a US or Canada location does not turn a dollar sign into a confirmed currency", () => {
  for (const location of ["Remote - US", "United States", "Canada", "Remote - USA or Canada"]) {
    const parsed = chooseOfficialSalary("$108,500 - $155,000 a year", location);
    assert.equal(parsed.salary_present, false, location);
    assert.equal(parsed.salary_currency, null);
    assert.ok(parsed.salary_parse_notes.includes("currency_unconfirmed"));
  }
});

test("an explicit USD code confirms the dollar range", () => {
  const parsed = chooseOfficialSalary("Base salary $108,500 - $155,000 USD a year", "Canada");
  assert.equal(parsed.salary_present, true);
  assert.equal(parsed.salary_currency, "USD");
});

test("Canada dollars stay CAD and are not stored as USD", () => {
  const parsed = chooseOfficialSalary("Canada: $150,500 - $215,000 CAD a year");
  assert.equal(parsed.salary_present, true);
  assert.equal(parsed.salary_currency, "CAD");
  assert.equal(parsed.salary_amount_min, 151000);
  assert.equal(parsed.salary_amount_max, 215000);
});

test("US and Canada bands stay separate instead of being merged", () => {
  const parsed = chooseOfficialSalary(
    "USA: $108,500 - $155,000 USD a year. Canada: $150,500 - $215,000 CAD a year.",
  );
  assert.equal(parsed.salary_present, false);
  assert.equal(parsed.salary_amount_min, null);
  assert.ok(parsed.salary_parse_notes.includes("multiple_salary_bands"));
});

test("PandaDoc OTE is not a guaranteed base salary", () => {
  const parsed = chooseOfficialSalary("The annual OTE is up to $255,000.");
  assert.equal(parsed.salary_present, false);
  assert.equal(parsed.salary_amount_min, null);
  assert.ok(parsed.salary_parse_notes.includes("ote_not_base"));
});
