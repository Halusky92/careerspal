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

test("named ATS headings become job-detail sections", () => {
  const sections = extractJobDetailSections(
    "About the role\nRun the weekly ops review.\n\nWhat you'll do\n- Build the tracker\n\nRequirements\n- SQL",
  );
  assert.equal(sections.length >= 2, true);
  assert.equal(sections[0]?.heading, "About the role");
  assert.equal(sections.some((s) => s.heading === "What you'll do"), true);
});
