import assert from "node:assert/strict";
import test from "node:test";
import { livenessClaimDecision } from "./livenessDay";

const NOW = new Date("2026-07-16T01:00:00.000Z");

test("liveness runs once per day and a reordered run does not repeat it", () => {
  assert.equal(livenessClaimDecision(null, NOW), "run");
  assert.equal(livenessClaimDecision({ status: "failed", createdAt: "2026-07-16T00:30:00.000Z" }, NOW), "run");
  assert.equal(livenessClaimDecision({ status: "done", createdAt: "2026-07-15T23:40:00.000Z" }, NOW), "skip");
  assert.equal(livenessClaimDecision({ status: "running", createdAt: "2026-07-16T00:55:00.000Z" }, NOW), "skip");
  assert.equal(livenessClaimDecision({ status: "running", createdAt: "2026-07-16T00:00:00.000Z" }, NOW), "run");
});
