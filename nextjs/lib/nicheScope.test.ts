import assert from "node:assert/strict";
import test from "node:test";
import { isOnNicheJob } from "./nicheScope";

test("marketing operations and campaign delivery on that team stay in the niche", () => {
  assert.equal(isOnNicheJob({ title: "Senior Marketing Operations Specialist" }), true);
  assert.equal(isOnNicheJob({ title: "Campaign Operations Manager (Individual Contributor)" }), true);
});

test("trading and recruiting operations do not pass on the word operations", () => {
  assert.equal(isOnNicheJob({ title: "Trading Operations Lead" }), false);
  assert.equal(isOnNicheJob({ title: "Senior Recruiting Operations Partner" }), false);
  assert.equal(isOnNicheJob({ title: "Broker Dealer Operations, Associate" }), false);
  assert.equal(isOnNicheJob({ title: "Senior Operations Associate" }), false);
  assert.equal(isOnNicheJob({ title: "Business Operations, Senior Associate" }), true);
});

test("an executive assistant or permit operations role does not pass on the word operations", () => {
  assert.equal(isOnNicheJob({ title: "Executive Operations Partner - EPD (Executive Assistant)" }), false);
  assert.equal(isOnNicheJob({ title: "Permit Operations Lead (Fully Remote)" }), false);
  assert.equal(isOnNicheJob({ title: "Permit Operations Lead (Bilingual - French/English)" }), false);
  assert.equal(isOnNicheJob({ title: "Administrative Assistant, Operations" }), false);
});

test("software testing, trading, recruiting, and finance titles stay out", () => {
  assert.equal(isOnNicheJob({ title: "QA Automation Engineer" }), false);
  assert.equal(isOnNicheJob({ title: "Test Automation Engineer" }), false);
  assert.equal(isOnNicheJob({ title: "SDET" }), false);
  assert.equal(isOnNicheJob({ title: "Fixed Income Operations Analyst" }), false);
  assert.equal(isOnNicheJob({ title: "Business Operations Director, Recruiting" }), false);
  assert.equal(isOnNicheJob({ title: "Director, Finance Strategy & Operations" }), false);
  assert.equal(isOnNicheJob({ title: "Sr. Systems Analyst, Finance, Enterprise Apps" }), true);
  assert.equal(isOnNicheJob({ title: "Workflow Automation Engineer" }), true);
  assert.equal(isOnNicheJob({ title: "Marketing Automation Specialist" }), true);
  assert.equal(isOnNicheJob({ title: "Revenue Operations Manager" }), true);
});

test("revenue, sales, product and GTM operations stay in the niche", () => {
  assert.equal(isOnNicheJob({ title: "Revenue Operations Manager" }), true);
  assert.equal(isOnNicheJob({ title: "Senior Manager, Sales Operations" }), true);
  assert.equal(isOnNicheJob({ title: "Member of Product Operations & Strategy Staff" }), true);
  assert.equal(isOnNicheJob({ title: "Senior Manager, GTM Operations" }), true);
});
