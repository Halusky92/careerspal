import assert from "node:assert/strict";
import test from "node:test";
import { extractJobDetailSections, formatSourcedDescription } from "./description";

test("Greenhouse vendor copy is dropped from sourced descriptions", () => {
  const text = formatSourcedDescription(
    "Own the ops calendar.\n\nGreenhouse is the talent operating system that helps companies hire.\n\nYou will run weekly reviews.",
  );
  assert.equal(text.includes("talent operating system"), false);
  assert.match(text, /ops calendar/);
});

test("a sentence that starts with a heading word stays a sentence", () => {
  const salary = formatSourcedDescription(
    "SALARY AND WORKING ARRANGEMENT\nBenefits for this role is expected to range from $135,000-$210,000.",
  );
  assert.match(salary, /Benefits for this role is expected/);
  assert.equal(salary.includes("Benefits:\nfor this role"), false);
  const sections = extractJobDetailSections(salary);
  assert.equal(sections.some((section) => section.body.startsWith("for this role")), false);

  const role = formatSourcedDescription("The role:\ncombines building new systems and improving existing ones.");
  assert.match(role, /The role combines building/);
  assert.equal(role.includes("\ncombines"), false);
});

test("decorative underscore lines are removed", () => {
  const text = formatSourcedDescription("About Docker\n_______________________________________________________________________\nWe are seeking a Senior Manager.");
  assert.equal(text.includes("____"), false);
  assert.match(text, /Senior Manager/);
});

test("named ATS headings become job-detail sections", () => {
  const sections = extractJobDetailSections(
    "About the role\nRun the weekly ops review.\n\nWhat you'll do\n- Build the tracker\n\nRequirements\n- SQL",
  );
  assert.equal(sections.length >= 2, true);
  assert.equal(sections[0]?.heading, "About the role");
  assert.equal(sections.some((s) => s.heading === "What you'll do"), true);
});
