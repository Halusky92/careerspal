import assert from "node:assert/strict";
import test from "node:test";
import { isEarlyAccessListing, isPriorityListing, listingsForViewer } from "./listingWindow";

const now = Date.parse("2026-11-16T12:00:00.000Z");

test("a role published today is premium-only and stays priority for a week", () => {
  const job = { publishedAt: "2026-11-16T02:00:00.000Z", timestamp: Date.parse("2026-11-01T00:00:00.000Z") };
  assert.equal(isEarlyAccessListing(job, now), true);
  assert.equal(isPriorityListing(job, now), true);
  assert.equal(listingsForViewer([job], "guest", now).length, 0);
  assert.equal(listingsForViewer([job], "registered", now).length, 0);
  assert.equal(listingsForViewer([job], "paid", now).length, 1);
});

test("after 24 hours the role is public and still marked new", () => {
  const job = { publishedAt: "2026-11-15T10:00:00.000Z" };
  assert.equal(isEarlyAccessListing(job, now), false);
  assert.equal(isPriorityListing(job, now), true);
  assert.equal(listingsForViewer([job], "guest", now).length, 1);
});

test("after 7 days it is a normal public role", () => {
  const job = { publishedAt: "2026-11-01T00:00:00.000Z" };
  assert.equal(isEarlyAccessListing(job, now), false);
  assert.equal(isPriorityListing(job, now), false);
});
