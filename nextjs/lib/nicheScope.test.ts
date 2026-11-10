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

test("revenue, sales, product and GTM operations stay in the niche", () => {
  assert.equal(isOnNicheJob({ title: "Revenue Operations Manager" }), true);
  assert.equal(isOnNicheJob({ title: "Senior Manager, Sales Operations" }), true);
  assert.equal(isOnNicheJob({ title: "Member of Product Operations & Strategy Staff" }), true);
  assert.equal(isOnNicheJob({ title: "Senior Manager, GTM Operations" }), true);
});
