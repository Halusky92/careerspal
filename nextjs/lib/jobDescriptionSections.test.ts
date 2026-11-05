import assert from "node:assert/strict";
import test from "node:test";
import { composeJobDescription, parseJobDescription } from "./jobDescriptionSections";

test("compose then parse round-trips the Indeed-style frames", () => {
  const composed = composeJobDescription({
    work: "Run weekly ops reviews.",
    who: "3 years in operations.",
    pay: "Equity and health cover.",
    about: "Remote product team.",
  });
  const parsed = parseJobDescription(composed);
  assert.equal(parsed.work, "Run weekly ops reviews.");
  assert.equal(parsed.who, "3 years in operations.");
  assert.equal(parsed.pay, "Equity and health cover.");
  assert.equal(parsed.about, "Remote product team.");
});

test("plain text lands in the work frame", () => {
  const parsed = parseJobDescription("Keep the board moving.");
  assert.equal(parsed.work, "Keep the board moving.");
  assert.equal(parsed.who, "");
});

test("empty sections are omitted from the stored description", () => {
  const composed = composeJobDescription({ work: "Ship process docs.", who: "", about: "" });
  assert.ok(composed.includes("What we do"));
  assert.ok(!composed.includes("Who you are"));
  assert.ok(!composed.includes("Pay and benefits"));
});

test("older What you'll do headings still parse", () => {
  const parsed = parseJobDescription("What you'll do\nOwn the ops calendar.\n\nWho we're looking for\nOps experience.");
  assert.equal(parsed.work, "Own the ops calendar.");
  assert.equal(parsed.who, "Ops experience.");
});

test("Who you are and Pay and benefits parse as optional frames", () => {
  const parsed = parseJobDescription(
    "What we do\nRun ops reviews.\n\nWho you are\nMinimum requirements\n- SQL\n\nPay and benefits\nHealth cover.",
  );
  assert.equal(parsed.work, "Run ops reviews.");
  assert.equal(parsed.who, "Minimum requirements\n- SQL");
  assert.equal(parsed.pay, "Health cover.");
});
