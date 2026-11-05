import assert from "node:assert/strict";
import test from "node:test";
import { composeJobDescription, parseJobDescription } from "./jobDescriptionSections";

test("compose then parse round-trips the three Indeed-style frames", () => {
  const composed = composeJobDescription({
    work: "Run weekly ops reviews.",
    who: "3 years in operations.",
    about: "Remote product team.",
  });
  const parsed = parseJobDescription(composed);
  assert.equal(parsed.work, "Run weekly ops reviews.");
  assert.equal(parsed.who, "3 years in operations.");
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
  assert.ok(!composed.includes("Who we're looking for"));
});

test("older What you'll do headings still parse", () => {
  const parsed = parseJobDescription("What you'll do\nOwn the ops calendar.\n\nWho we're looking for\nOps experience.");
  assert.equal(parsed.work, "Own the ops calendar.");
  assert.equal(parsed.who, "Ops experience.");
});
