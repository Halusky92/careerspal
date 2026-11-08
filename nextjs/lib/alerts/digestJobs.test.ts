import assert from "node:assert/strict";
import test from "node:test";
import { jobsForDigest } from "./digestJobs";

test("trial digest uses live jobs when nothing new matched", () => {
  assert.deepEqual(jobsForDigest([], ["a", "b", "c"], true, 2), ["a", "b"]);
});

test("scheduled digest stays silent when nothing matched", () => {
  assert.deepEqual(jobsForDigest([], ["a"], false), []);
});

test("matched jobs win over the live fallback", () => {
  assert.deepEqual(jobsForDigest(["m"], ["a"], true), ["m"]);
});
