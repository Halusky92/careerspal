import assert from "node:assert/strict";
import test from "node:test";
import { mentionedPostingTools, toggleTool, toolChipHolds, toolsForCategory, toolsToKeywords } from "./postingTools";

test("toggle adds then removes a tool without duplicates", () => {
  const once = toggleTool(["Notion"], "zapier");
  assert.deepEqual(once, ["Notion", "zapier"]);
  const twice = toggleTool(once, "Zapier");
  assert.deepEqual(twice, ["Notion"]);
});

test("category list puts matching tools first", () => {
  const tools = toolsForCategory("Automation");
  assert.equal(tools[0], "Make");
  assert.ok(tools.includes("Notion"));
});

test("tool chips ignore verbs and words inside other words", () => {
  const text = "workflows that make autonomous reviews excellent for customer segmentation.";
  assert.equal(toolChipHolds("Make", text), false);
  assert.equal(toolChipHolds("Excel", text), false);
  assert.equal(toolChipHolds("Segment", text), false);
  assert.equal(toolChipHolds("Make", "The team runs Make.com scenarios."), true);
  assert.equal(toolChipHolds("Excel", "Daily reporting in Excel."), true);
  assert.equal(toolChipHolds("Segment", "Events go to Segment."), true);
  assert.deepEqual(mentionedPostingTools(text), []);
});

test("keywords stay a simple comma list for AI draft", () => {
  assert.equal(toolsToKeywords(["Notion", "Zapier"]), "Notion, Zapier");
});
