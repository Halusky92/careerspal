import assert from "node:assert/strict";
import test from "node:test";
import { batchCap, descriptionReadCap, pacificDayStart, quotaAttempts } from "./quota";

test("the quota day starts at Pacific midnight", () => {
  const winter = pacificDayStart(new Date("2026-11-27T07:30:00.000Z"));
  assert.equal(winter.toISOString(), "2026-11-26T08:00:00.000Z");
  const summer = pacificDayStart(new Date("2026-07-15T06:30:00.000Z"));
  assert.equal(summer.toISOString(), "2026-07-14T07:00:00.000Z");
});

test("successful and failed attempts inside the Pacific day count", () => {
  const now = new Date("2026-11-27T07:30:00.000Z");
  const used = quotaAttempts([
    { attempts: 2, createdAt: "2026-11-26T09:00:00.000Z" },
    { attempts: 1, createdAt: "2026-11-26T07:00:00.000Z" },
    { attempts: 3, createdAt: "2026-11-27T01:00:00.000Z" },
  ], now);
  assert.equal(used, 5);
});

test("a manual batch cannot exceed 5 until live sending is on", () => {
  assert.equal(batchCap({ live: false, requested: 20 }), 5);
  assert.equal(batchCap({ live: false, requested: 2 }), 2);
  assert.equal(batchCap({ live: true, requested: 20 }), 20);
  assert.equal(batchCap({ live: true, requested: 80 }), 40);
  assert.equal(descriptionReadCap(5), 20);
});
