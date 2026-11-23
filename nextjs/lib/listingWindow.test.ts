import assert from "node:assert/strict";
import test from "node:test";
import { isEarlyAccessListing, isNewListing, isPriorityListing, listingsForViewer } from "./listingWindow";

const now = Date.parse("2026-11-16T12:00:00.000Z");

test("a role published today is premium-only and stays priority for a week", () => {
  const job = { publishedAt: "2026-11-16T02:00:00.000Z", timestamp: Date.parse("2026-11-01T00:00:00.000Z") };
  assert.equal(isEarlyAccessListing(job, now), true);
  assert.equal(isNewListing(job, now), false);
  assert.equal(isPriorityListing(job, now), true);
  assert.equal(listingsForViewer([job], "guest", now).length, 0);
  assert.equal(listingsForViewer([job], "registered", now).length, 0);
  assert.equal(listingsForViewer([job], "paid", now).length, 1);
});

test("after 24 hours the role is public and still marked new", () => {
  const job = { publishedAt: "2026-11-15T10:00:00.000Z" };
  assert.equal(isEarlyAccessListing(job, now), false);
  assert.equal(isNewListing(job, now), true);
  assert.equal(isPriorityListing(job, now), true);
  assert.equal(listingsForViewer([job], "guest", now).length, 1);
});

test("the new mark ends after three days and the sort boost lasts seven", () => {
  const stillNew = { publishedAt: "2026-11-14T13:00:00.000Z" };
  assert.equal(isNewListing(stillNew, now), true);
  assert.equal(isPriorityListing(stillNew, now), true);
  const sortOnly = { publishedAt: "2026-11-12T10:00:00.000Z" };
  assert.equal(isNewListing(sortOnly, now), false);
  assert.equal(isPriorityListing(sortOnly, now), true);
});

test("an older source date does not stay New after the role is added to the board", () => {
  const job = { publishedAt: "2026-11-16T02:00:00.000Z", timestamp: Date.parse("2026-11-10T00:00:00.000Z") };
  assert.equal(isNewListing(job, now), false);
  assert.equal(isNewListing({ timestamp: Date.parse("2026-11-15T12:00:00.000Z") }, now), true);
});

test("after 7 days it is a normal public role", () => {
  const job = { publishedAt: "2026-11-01T00:00:00.000Z" };
  assert.equal(isEarlyAccessListing(job, now), false);
  assert.equal(isNewListing(job, now), false);
  assert.equal(isPriorityListing(job, now), false);
});
