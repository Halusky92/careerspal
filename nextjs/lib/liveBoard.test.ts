import assert from "node:assert/strict";
import test from "node:test";
import { isLiveBoardJob, liveBoardCutoffMs } from "./liveBoard";

test("a recent publish date keeps a job live when the posted timestamp is older", () => {
  const old = liveBoardCutoffMs() - 10 * 24 * 60 * 60 * 1000;
  assert.equal(isLiveBoardJob({ timestamp: old }), false);
  assert.equal(isLiveBoardJob({ timestamp: old, published_at: new Date().toISOString() }), true);
});
