import assert from "node:assert/strict";
import test from "node:test";
import { CLOSE_CONFIRM_GAP_MS, CLOSE_STREAK_REQUIRED } from "../boardHealth";
import { publicLogoUrlForWebsite } from "../../companyLogoUrl";
import { formatSourcedDescription } from "../normalization/description";
import { toPendingSourceRow } from "./review";
import {
  BOARDS_PER_GROUP,
  DISCOVERY_GROUPS,
  MONTHLY_SEARCH_CAP,
  claimSearchSlot,
  nextPhraseState,
  phraseForGroup,
  runJobFirstDiscovery,
  seedBoardKeys,
  selectNewBoards,
  assertProductionDatabaseUrl,
  assertStagingDatabaseUrl,
} from "./jobfirst";

test("every full run keeps one slot for each niche group", () => {
  assert.equal(DISCOVERY_GROUPS.length, 8);
  assert.equal(new Set(DISCOVERY_GROUPS.map((group) => group.id)).size, 8);
  assert.equal(BOARDS_PER_GROUP, 4);
  assert.equal(MONTHLY_SEARCH_CAP, 620);
});

test("a cooled phrase spends no search and the next variant rotates", () => {
  const now = new Date("2026-11-10T12:00:00.000Z");
  const cooled = phraseForGroup(["one", "two"], { variantIndex: 0, zeroNewStreak: 0, cooledUntil: "2026-11-20T00:00:00.000Z" }, now);
  assert.equal(cooled, null);
  const open = phraseForGroup(["one", "two"], { variantIndex: 1, zeroNewStreak: 0, cooledUntil: null }, now);
  assert.equal(open?.phrase, "two");
  const again = nextPhraseState({ variantIndex: 1, zeroNewStreak: 1, cooledUntil: null }, 1, 2, 0, now);
  assert.equal(again.variantIndex, 0);
  assert.ok(again.cooledUntil);
});

test("the monthly counter stops at 620 and does not wrap", () => {
  assert.equal(claimSearchSlot(619).ok, true);
  assert.equal(claimSearchSlot(619).next, 620);
  assert.equal(claimSearchSlot(620).ok, false);
  assert.equal(claimSearchSlot(620).next, 620);
});

test("new boards exclude seeds, aggregators, and duplicates, and stop at four", () => {
  const known = seedBoardKeys();
  const hits = [
    { url: "https://boards.greenhouse.io/gitlab/jobs/1", title: "GitLab" },
    { url: "https://jobs.lever.co/jobgether/abc", title: "Jobgether" },
    { url: "https://jobs.ashbyhq.com/opensesame", title: "OpenSesame" },
    { url: "https://jobs.ashbyhq.com/opensesame/one", title: "again" },
    { url: "https://boards.greenhouse.io/alpha", title: "A" },
    { url: "https://boards.greenhouse.io/beta", title: "B" },
    { url: "https://jobs.lever.co/gamma", title: "C" },
    { url: "https://jobs.ashbyhq.com/delta", title: "D" },
    { url: "https://jobs.ashbyhq.com/epsilon", title: "E" },
  ];
  const chosen = selectNewBoards(hits, known);
  assert.deepEqual(chosen.map((board) => board.identifier), ["opensesame", "alpha", "beta", "gamma"]);
});

test("a full run covers all eight groups until the credit cap", async () => {
  const calls: string[] = [];
  let n = 0;
  const result = await runJobFirstDiscovery({
    now: new Date("2026-11-10T12:00:00.000Z"),
    monthCount: 247,
    cap: 250,
    phrases: {},
    known: seedBoardKeys(),
    search: async (query) => {
      calls.push(query);
      n += 1;
      return [{ url: `https://boards.greenhouse.io/newco${n}/jobs/1`, title: query }];
    },
    review: async () => ({
      companyName: "Newco",
      website: "https://boards.greenhouse.io/newco",
      atsProvider: "greenhouse",
      atsIdentifier: "newco",
      boardUrl: "https://boards.greenhouse.io/newco",
      openJobCount: 3,
      qualifyingJobCount: 1,
      qualifyingTitles: ["Revenue Operations Manager"],
      qualifyingJobs: [],
      sampledNicheJobs: 1,
      unsampledNicheJobs: 0,
      rejectionCounts: {},
      qualifyingApplyUrls: ["https://boards.greenhouse.io/newco/jobs/1"],
      decision: "pending_approval",
      reason: "pending",
      enabled: false,
    }),
  });
  assert.equal(result.searches, 3);
  assert.equal(result.endingCount, 250);
  assert.equal(result.stopped, "monthly_cap");
  assert.equal(result.groups.filter((group) => group.skipped === "").length, 3);
  assert.equal(result.groups.filter((group) => group.skipped === "monthly_cap").length, 5);
  assert.equal(calls.length, 3);
  assert.equal(result.pending.length, 3);
  assert.equal(result.pending.every((row) => row.enabled === false), true);
});

test("staging writes refuse the production database", () => {
  assert.doesNotThrow(() => assertStagingDatabaseUrl("https://rpwutygkiiphqdphitdg.supabase.co"));
  assert.throws(() => assertStagingDatabaseUrl("https://uahdliiwhvviinujtyjj.supabase.co"));
});

test("production writes accept only the production project", () => {
  assert.doesNotThrow(() => assertProductionDatabaseUrl("https://uahdliiwhvviinujtyjj.supabase.co"));
  assert.throws(() => assertProductionDatabaseUrl("https://rpwutygkiiphqdphitdg.supabase.co"));
  assert.throws(() => assertProductionDatabaseUrl("https://example.supabase.co"));
});

test("a capped run stops after four boards and eight searches", async () => {
  let n = 0;
  const result = await runJobFirstDiscovery({
    now: new Date("2026-11-11T00:00:00.000Z"),
    monthCount: 0,
    phrases: {},
    known: seedBoardKeys(),
    maxSearches: 8,
    maxBoards: 4,
    search: async () => {
      n += 1;
      return [{ url: `https://boards.greenhouse.io/capco${n}`, title: "Cap" }];
    },
    review: async () => ({
      companyName: "Cap",
      website: "https://boards.greenhouse.io/capco",
      atsProvider: "greenhouse",
      atsIdentifier: "capco",
      boardUrl: "https://boards.greenhouse.io/capco",
      openJobCount: 1,
      qualifyingJobCount: 1,
      qualifyingTitles: [],
      qualifyingJobs: [],
      sampledNicheJobs: 1,
      unsampledNicheJobs: 0,
      rejectionCounts: {},
      qualifyingApplyUrls: [],
      decision: "pending_approval",
      reason: "pending",
      enabled: false,
    }),
  });
  assert.equal(result.searches, 4);
  assert.equal(result.pending.length, 4);
  assert.equal(result.stopped, "board_cap");
  assert.equal(result.pending.every((row) => row.enabled === false), true);
});

test("discovery leaves company logos, descriptions, and closing rules on the existing path", () => {
  assert.equal(publicLogoUrlForWebsite("https://boards.greenhouse.io/acme"), null);
  assert.equal(publicLogoUrlForWebsite("https://acme.com"), "https://www.google.com/s2/favicons?domain=acme.com&sz=128");
  const formatted = formatSourcedDescription("<p>About the role</p><p>Own the revenue operations cadence.</p>");
  assert.match(formatted, /revenue operations/i);
  assert.equal(CLOSE_STREAK_REQUIRED, 2);
  assert.equal(CLOSE_CONFIRM_GAP_MS, 12 * 60 * 60 * 1000);
  const row = toPendingSourceRow({
    companyName: "OpenSesame",
    website: "https://boards.greenhouse.io/opensesame",
    atsProvider: "greenhouse",
    atsIdentifier: "opensesame",
    boardUrl: "https://boards.greenhouse.io/opensesame",
    openJobCount: 19,
    qualifyingJobCount: 2,
    qualifyingTitles: [],
    qualifyingJobs: [],
    sampledNicheJobs: 2,
    unsampledNicheJobs: 0,
    rejectionCounts: {},
    qualifyingApplyUrls: [],
    decision: "pending_approval",
    reason: "pending",
    enabled: false,
  });
  assert.equal(row?.enabled, false);
  assert.equal(row?.approval_decision, null);
});
