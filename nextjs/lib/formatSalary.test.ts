import assert from "node:assert/strict";
import test from "node:test";
import { formatEmployerSalaryForStorage } from "./formatSalary";

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
