import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isEarlyAccessListing, isNewListing, isPriorityListing, listingAgeBadge, listingsForViewer } from "./listingWindow";

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

test("the card mark is Premium, then New, then nothing", () => {
  const premium = { publishedAt: "2026-11-16T02:00:00.000Z", timestamp: Date.parse("2026-11-16T02:00:00.000Z") };
  const fresh = { publishedAt: "2026-11-15T10:00:00.000Z", timestamp: Date.parse("2026-11-15T10:00:00.000Z") };
  const quiet = { publishedAt: "2026-11-12T10:00:00.000Z", timestamp: Date.parse("2026-11-12T10:00:00.000Z") };
  assert.equal(listingAgeBadge(premium, now), "premium");
  assert.equal(listingAgeBadge(fresh, now), "new");
  assert.equal(listingAgeBadge(quiet, now), null);
  assert.equal(listingsForViewer([premium], "guest", now).length, 0);
  assert.equal(listingsForViewer([premium], "paid", now).length, 1);
});

test("premium cards keep the gold treatment and New cards use a lighter tint", () => {
  const badge = readFileSync(new URL("../components/PremiumWindowBadge.tsx", import.meta.url), "utf8");
  const row = readFileSync(new URL("../components/JobRow.tsx", import.meta.url), "utf8");
  const home = readFileSync(new URL("../components/HomePreviewCard.tsx", import.meta.url), "utf8");
  const detail = readFileSync(new URL("../app/jobs/[slug]/page.tsx", import.meta.url), "utf8");
  assert.match(badge, /bg-\[#e4c56a\].*text-slate-950/s);
  assert.match(badge, />\s*Premium\s*</);
  assert.match(row, /bg-\[#fbf8f2\] border-\[#c6a15b\]/);
  assert.match(row, /bg-\[#fefcf6\] border-\[#efe6d4\]/);
  assert.match(home, /border-\[#c6a15b\] bg-\[#fbf8f2\]/);
  assert.match(home, /border-\[#efe6d4\] bg-\[#fefcf6\]/);
  assert.match(detail, /early \? "border-\[#c6a15b\]" : "border-slate-200"/);
});

test("after 7 days it is a normal public role", () => {
  const job = { publishedAt: "2026-11-01T00:00:00.000Z" };
  assert.equal(isEarlyAccessListing(job, now), false);
  assert.equal(isNewListing(job, now), false);
  assert.equal(isPriorityListing(job, now), false);
});
