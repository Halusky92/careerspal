import assert from "node:assert/strict";
import test from "node:test";
import {
  DAILY_SEARCH_CAP,
  DISCOVERY_GROUPS,
  MONTHLY_SEARCH_CAP,
  rotateDiscoveryGroups,
  runJobFirstDiscovery,
  sameUtcDay,
} from "./jobfirst";

test("daily discovery rotates every category and keeps both caps", () => {
  assert.equal(DISCOVERY_GROUPS.length, 8);
  assert.equal(DAILY_SEARCH_CAP, 20);
  assert.equal(MONTHLY_SEARCH_CAP, 620);
  const first = rotateDiscoveryGroups(DISCOVERY_GROUPS, new Date("2026-11-11T09:00:00.000Z"));
  const next = rotateDiscoveryGroups(DISCOVERY_GROUPS, new Date("2026-11-12T09:00:00.000Z"));
  assert.equal(first.length, 8);
  assert.equal(new Set(first.map((group) => group.id)).size, 8);
  assert.notEqual(first[0].id, next[0].id);
});

test("a category searched today is not searched again", async () => {
  const now = new Date("2026-11-11T09:00:00.000Z");
  let searches = 0;
  const result = await runJobFirstDiscovery({
    now,
    monthCount: 249,
    phrases: { revops: { variantIndex: 0, zeroNewStreak: 0, cooledUntil: null, updatedAt: "2026-11-11T01:00:00.000Z" } },
    known: new Set(),
    groups: DISCOVERY_GROUPS.slice(0, 2),
    maxSearches: DAILY_SEARCH_CAP,
    oncePerDay: true,
    claim: async () => false,
    search: async () => {
      searches += 1;
      return [];
    },
    review: async () => {
      throw new Error("no review");
    },
  });
  assert.equal(searches, 0);
  assert.equal(result.searches, 0);
  assert.equal(result.groups[0].skipped, "already_today");
  assert.equal(result.groups[1].skipped, "monthly_cap");
  assert.equal(sameUtcDay("2026-11-11T23:00:00.000Z", now), true);
  assert.equal(sameUtcDay("2026-12-01T00:00:00.000Z", now), false);
});

test("the daily cap uses the next phrase and does not repeat a search", async () => {
  const groups = ["revops", "sales-ops", "bizops", "chief-of-staff", "product-ops", "systems", "automation", "gtm-ops"].map((id) => ({
    id,
    phrases: [`${id} one`, `${id} two`, `${id} three`],
  }));
  const seen = new Set<string>();
  const result = await runJobFirstDiscovery({
    now: new Date("2026-11-12T00:30:00.000Z"),
    monthCount: 0,
    phrases: {},
    known: new Set(),
    groups,
    maxSearches: DAILY_SEARCH_CAP,
    oncePerDay: true,
    search: async (query) => {
      seen.add(query);
      const token = query.toLowerCase().replace(/[^a-z0-9]+/g, "");
      return [{ url: `https://boards.greenhouse.io/${token}`, title: query }];
    },
    review: async () => ({
      companyName: "Fixture",
      website: "https://fixture.example",
      atsProvider: "greenhouse",
      atsIdentifier: "fixture",
      boardUrl: "https://boards.greenhouse.io/fixture",
      openJobCount: 1,
      qualifyingJobCount: 0,
      qualifyingTitles: [],
      qualifyingJobs: [],
      sampledNicheJobs: 0,
      unsampledNicheJobs: 0,
      rejectionCounts: {},
      qualifyingApplyUrls: [],
      decision: "rejected",
      reason: "fixture",
      enabled: false,
    }),
  });
  assert.equal(result.searches, 20);
  assert.equal(seen.size, 20);
  assert.equal(result.stopped, "search_cap");
});
