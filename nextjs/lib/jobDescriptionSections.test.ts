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
  assert.ok(composed.includes("What you'll do"));
  assert.ok(!composed.includes("Who we're looking for"));
});
