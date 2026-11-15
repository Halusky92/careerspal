import assert from "node:assert/strict";
import test from "node:test";
import { jobIdToRestore, readJobsReturnPlace } from "./jobsReturn";

test("a job link in the address wins over the saved return point", () => {
  assert.equal(jobIdToRestore("from-url", JSON.stringify({ jobId: "saved" })), "from-url");
});

test("the saved place keeps the list window and scroll position", () => {
  const place = readJobsReturnPlace(JSON.stringify({ jobId: "saved", scrollY: 1800, visibleCount: 28, loadedCount: 50 }));
  assert.deepEqual(place, { jobId: "saved", scrollY: 1800, visibleCount: 28, loadedCount: 50 });
  assert.equal(jobIdToRestore(null, JSON.stringify({ jobId: "saved", scrollY: 1800, visibleCount: 28 })), "saved");
  assert.equal(jobIdToRestore("  ", "{"), null);
});
