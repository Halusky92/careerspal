import assert from "node:assert/strict";
import test from "node:test";
import { filterJobTitleSuggestions } from "./jobTitleSuggestions";

test("empty query shows category titles first", () => {
  const titles = filterJobTitleSuggestions("", [], 6, "Automation");
  assert.equal(titles[0], "Workflow Automation Specialist");
  assert.ok(titles.includes("Automation Engineer"));
});

test("typed text ranks starts-with above contains and does not replace the query", () => {
  const titles = filterJobTitleSuggestions("rev", [], 8, "Marketing & Growth Ops");
  assert.ok(titles[0].toLowerCase().startsWith("rev"));
  assert.ok(!titles.some((title) => title.toLowerCase() === "rev"));
});

test("live titles can appear without wiping curated pool", () => {
  const titles = filterJobTitleSuggestions("ops", ["Ops Program Manager"], 10, "Operations");
  assert.ok(titles.includes("Ops Program Manager"));
  assert.ok(titles.includes("BizOps Analyst"));
});
