import assert from "node:assert/strict";
import test from "node:test";
import { jobIdToRestore } from "./jobsReturn";

test("a job link in the address wins over the saved return point", () => {
  assert.equal(jobIdToRestore("from-url", JSON.stringify({ jobId: "saved" })), "from-url");
});

test("the saved job is used when the address has no job", () => {
  assert.equal(jobIdToRestore(null, JSON.stringify({ jobId: "saved" })), "saved");
  assert.equal(jobIdToRestore("  ", "{"), null);
});
