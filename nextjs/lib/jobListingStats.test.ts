import assert from "node:assert/strict";
import test from "node:test";
import {
  applyClickRate,
  buildDailyTraffic,
  formatApplyClickRate,
  rollupTrafficSources,
} from "./jobListingStats";

test("apply rate is omitted until there is at least one unique view", () => {
  assert.equal(applyClickRate(0, 2), null);
  assert.equal(formatApplyClickRate(null), "—");
  assert.equal(applyClickRate(10, 2), 0.2);
  assert.equal(formatApplyClickRate(0.2), "20%");
});

test("daily traffic fills empty days instead of inventing counts", () => {
  const now = new Date("2026-11-05T12:00:00.000Z");
  const days = buildDailyTraffic(
    ["2026-11-05T08:00:00.000Z", "2026-11-05T09:00:00.000Z", "2026-11-03T01:00:00.000Z"],
    ["2026-11-05T10:00:00.000Z"],
    4,
    now,
  );
  assert.deepEqual(
    days.map((day) => ({ date: day.date, views: day.views, applyClicks: day.applyClicks })),
    [
      { date: "2026-11-02", views: 0, applyClicks: 0 },
      { date: "2026-11-03", views: 1, applyClicks: 0 },
      { date: "2026-11-04", views: 0, applyClicks: 0 },
      { date: "2026-11-05", views: 2, applyClicks: 1 },
    ],
  );
});

test("source rollup uses logged view and apply_click actions", () => {
  const rows = rollupTrafficSources([
    { action: "view", metadata: { source: "board" } },
    { action: "view", metadata: { source: "board" } },
    { action: "apply_click", metadata: { source: "job_page" } },
  ]);
  assert.equal(rows[0].source, "board");
  assert.equal(rows[0].views, 2);
  assert.equal(rows[1].applyClicks, 1);
  assert.equal(rows[1].label, "Role page");
});
