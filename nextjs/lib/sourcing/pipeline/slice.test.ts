import assert from "node:assert/strict";
import test from "node:test";
import {
  chooseSalarySource,
  countPublishOutcomes,
  parseSliceMode,
  shouldReopenUnpublishedCandidate,
  sliceBudgetMs,
  sliceExpired,
  sourcingDayKey,
  sourcingDayStart,
  sourcesDueForRefresh,
} from "./slice";

const NOW = Date.parse("2026-11-10T16:00:00.000Z");
const TODAY = "2026-11-10T06:00:00.000Z";
const YESTERDAY = "2026-11-09T06:00:00.000Z";

test("refresh and salary slices stay inside the platform limit", () => {
  assert.equal(parseSliceMode(null), "refresh");
  assert.equal(parseSliceMode("salary"), "salary");
  assert.equal(sliceBudgetMs("refresh"), 45_000);
  assert.equal(sliceBudgetMs("salary"), 45_000);
  assert.equal(sliceBudgetMs("full"), 240_000);
  assert.equal(sliceExpired(NOW, NOW), true);
  assert.equal(sliceExpired(NOW + 1, NOW), false);
  assert.equal(sliceExpired(null, NOW), false);
});

test("the sourcing day follows Europe/Bratislava across the summer midnight", () => {
  const beforeUtcMidnight = new Date("2026-07-15T23:30:00.000Z");
  const afterUtcMidnight = new Date("2026-07-16T01:00:00.000Z");
  assert.equal(sourcingDayKey(beforeUtcMidnight), "2026-07-16");
  assert.equal(sourcingDayKey(afterUtcMidnight), "2026-07-16");
  assert.equal(sourcingDayStart(beforeUtcMidnight).toISOString(), "2026-07-15T22:00:00.000Z");
  assert.equal(sourcingDayStart(afterUtcMidnight).toISOString(), "2026-07-15T22:00:00.000Z");
  assert.equal(sourcingDayKey(new Date("2026-11-12T00:30:00.000Z")), "2026-11-12");
  assert.equal(sourcingDayStart(new Date("2026-11-12T00:30:00.000Z")).toISOString(), "2026-11-11T23:00:00.000Z");
});

test("a finished board waits until tomorrow and a partial board is resumed", () => {
  const due = sourcesDueForRefresh(
    [
      { id: "done", startedAt: TODAY, status: "success" },
      { id: "failed", startedAt: TODAY, status: "failed" },
      { id: "partial", startedAt: TODAY, status: "partial" },
      { id: "old", startedAt: YESTERDAY, status: "success" },
      { id: "never", startedAt: null, status: null },
    ],
    new Date(NOW),
    10,
  );
  assert.deepEqual(due, ["never", "old", "partial"]);
});

test("an empty refresh queue does not fall back to boards already done today", () => {
  const due = sourcesDueForRefresh([{ id: "done", startedAt: TODAY, status: "success" }], new Date(NOW), 1);
  assert.deepEqual(due, []);
});

test("a board finished before the UTC date changes stays finished for the Bratislava day", () => {
  const now = new Date("2026-07-16T01:00:00.000Z");
  const due = sourcesDueForRefresh(
    [
      { id: "done", startedAt: "2026-07-15T23:30:00.000Z", status: "success" },
      { id: "failed", startedAt: "2026-07-15T23:40:00.000Z", status: "failed" },
      { id: "partial", startedAt: "2026-07-15T23:45:00.000Z", status: "partial" },
      { id: "yesterday", startedAt: "2026-07-15T20:00:00.000Z", status: "success" },
    ],
    now,
    10,
  );
  assert.deepEqual(due, ["yesterday", "partial"]);
});

test("salary slice picks one company and stops after eight lookups that day", () => {
  const rows = [
    ...Array.from({ length: 8 }, () => ({
      sourceId: "full",
      provenance: { salary_enrichment_attempt: { attempted_at: TODAY } },
    })),
    { sourceId: "due", provenance: {} },
    { sourceId: "cooled", provenance: { salary_enrichment_attempt: { attempted_at: "2026-11-10T15:30:00.000Z" } } },
    { sourceId: "off", provenance: {} },
  ];
  assert.equal(chooseSalarySource(rows, ["full", "due", "cooled"], NOW), "due");
  assert.equal(chooseSalarySource([{ sourceId: "due", provenance: {} }], ["due"], NOW), "due");
  assert.equal(
    chooseSalarySource(
      [{ sourceId: "cooled", provenance: { salary_enrichment: { fetched_at: "2026-11-10T15:00:00.000Z" } } }],
      ["cooled"],
      NOW,
    ),
    null,
  );
});

test("salary does not repeat a company after UTC midnight on the same Bratislava day", () => {
  const attempted = "2026-07-15T23:30:00.000Z";
  const now = Date.parse("2026-07-16T01:00:00.000Z");
  assert.equal(
    chooseSalarySource(
      [{ sourceId: "checked", provenance: { salary_enrichment_attempt: { attempted_at: attempted } } }],
      ["checked"],
      now,
      0,
      1,
    ),
    null,
  );
  assert.equal(chooseSalarySource([{ sourceId: "fresh", provenance: {} }], ["fresh"], now, 0, 1), "fresh");
});

test("each skipped job is counted once even when several rules fail", () => {
  const reasons = countPublishOutcomes([
    { status: "skipped", reason: ["salary_missing", "off_niche_title", "score_below_min(70<85)"] },
    { status: "skipped", reason: ["onsite_only"] },
    { status: "skipped", reason: "apply_dead:404" },
    { status: "published" },
    { status: "skipped_duplicate" },
  ]);
  assert.deepEqual(reasons, { salary_missing: 1, onsite_only: 1, apply_dead: 1 });
});

test("a changed board listing reopens an unpublished candidate and leaves a live job alone", () => {
  assert.equal(
    shouldReopenUnpublishedCandidate({ publishedJobId: null, previousHash: "a", nextHash: "b" }),
    true,
  );
  assert.equal(
    shouldReopenUnpublishedCandidate({ publishedJobId: null, previousHash: "a", nextHash: "a" }),
    false,
  );
  assert.equal(
    shouldReopenUnpublishedCandidate({ publishedJobId: "job-1", previousHash: "a", nextHash: "b" }),
    false,
  );
});
