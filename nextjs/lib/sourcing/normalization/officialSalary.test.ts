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

test("PandaDoc OTE is not a guaranteed base salary", () => {
  const parsed = chooseOfficialSalary("The annual OTE is up to $255,000.");
  assert.equal(parsed.salary_present, false);
  assert.equal(parsed.salary_amount_min, null);
  assert.ok(parsed.salary_parse_notes.includes("ote_not_base"));
});
