import assert from "node:assert/strict";
import test from "node:test";
import { classifySourcedFreshness, rawHashDecision, shouldExpireSourcedByAge } from "./freshness";

test("hash match is unchanged; new or different hashes update", () => {
  assert.equal(rawHashDecision(null, "abc"), "insert");
  assert.equal(rawHashDecision("abc", "abc"), "unchanged");
  assert.equal(rawHashDecision("abc", "def"), "update");
});

test("recent last_seen stays active even if the original post is old", () => {
  const now = Date.parse("2026-11-09T12:00:00.000Z");
  assert.equal(
    classifySourcedFreshness({ lastSeenAt: "2026-11-08T12:00:00.000Z", now }),
    "active",
  );
  assert.equal(
    classifySourcedFreshness({ lastSeenAt: "2026-10-01T12:00:00.000Z", now }),
    "unverified",
  );
  assert.equal(classifySourcedFreshness({ lastSeenAt: null, now }), "unverified");
  assert.equal(classifySourcedFreshness({ confirmedRemoved: true, now }), "removed");
});

test("age alone never expires a sourced listing", () => {
  assert.equal(shouldExpireSourcedByAge({ lastSeenAt: "2026-01-01T00:00:00.000Z" }), false);
  assert.equal(shouldExpireSourcedByAge({ lastSeenAt: null }), false);
  assert.equal(shouldExpireSourcedByAge({ confirmedRemoved: true }), true);
});
