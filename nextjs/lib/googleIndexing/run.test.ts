import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJobUrl, indexFingerprint, type IndexJobSnapshot } from "./plan";
import { executeIndexingRun, recordWithRetry } from "./run";

function job(): IndexJobSnapshot {
  return {
    id: "job-1",
    title: "Revenue Operations Manager",
    company: "Example",
    location: "United States",
    workMode: "Remote",
    employmentType: "Full-time",
    salaryLabel: "$120k–$150k a year",
    salaryMin: 120000,
    salaryMax: 150000,
    salaryCurrency: "USD",
    salaryPeriod: "year",
    applyUrl: "https://jobs.example.com/revops",
    description: "Own the weekly forecast.",
    contentHash: "hash-a",
    visibility: "job_posting",
  };
}

const base = {
  jobs: [job()],
  jobsReadOk: true,
  scanComplete: true,
  history: [],
  historyReadOk: true,
  quotaUsed: 0,
  dailyQuota: 200,
  perRunCap: 5,
};

test("dry-run does not publish or record", async () => {
  let published = 0;
  const run = await executeIndexingRun({
    ...base,
    live: false,
    publish: async () => {
      published += 1;
      return { ok: true, status: 200, attempts: 1, retryable: false, error: null };
    },
    record: async () => true,
    claim: async () => true,
  });
  assert.equal(run.dryRun, true);
  assert.equal(published, 0);
  assert.equal(run.plan.batchUpdated, 1);
});

test("live sending records only after Google accepts", async () => {
  const writes: string[] = [];
  const run = await executeIndexingRun({
    ...base,
    live: true,
    claim: async () => true,
    release: async () => {},
    publish: async () => ({ ok: true, status: 200, attempts: 1, retryable: false, error: null }),
    record: async (notice, result) => {
      assert.equal(result.ok, true);
      writes.push(notice.type);
      return true;
    },
  });
  assert.equal(run.dryRun, false);
  assert.deepEqual(writes, ["URL_UPDATED"]);
  assert.equal(run.sent.length, 1);
  assert.equal(run.unrecorded.length, 0);
});

test("a lost history write is reported and not sent again in the same run", async () => {
  let publishes = 0;
  const run = await executeIndexingRun({
    ...base,
    live: true,
    claim: async () => true,
    release: async () => {},
    publish: async () => {
      publishes += 1;
      return { ok: true, status: 200, attempts: 1, retryable: false, error: null };
    },
    record: async () => false,
  });
  assert.equal(publishes, 1);
  assert.equal(run.unrecorded.length, 1);
  assert.equal(run.sent.length, 0);
});

test("live sending waits for the lock", async () => {
  let published = 0;
  const run = await executeIndexingRun({
    ...base,
    live: true,
    claim: async () => false,
    publish: async () => {
      published += 1;
      return { ok: true, status: 200, attempts: 1, retryable: false, error: null };
    },
    record: async () => true,
  });
  assert.equal(run.aborted, "lock_unavailable");
  assert.equal(published, 0);
});

test("history retries and then reports the failure", async () => {
  let tries = 0;
  const saved = await recordWithRetry(async () => {
    tries += 1;
    return tries === 2;
  }, async () => {});
  assert.equal(saved, true);
  assert.equal(tries, 2);
  const url = canonicalJobUrl(job());
  assert.equal(indexFingerprint(job()).length, 64);
  assert.equal(url.startsWith("https://www.careerspal.com/jobs/"), true);
});
