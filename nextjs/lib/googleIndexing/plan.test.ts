import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  canonicalJobUrl,
  googleIndexingLiveEnabled,
  indexFingerprint,
  indexVisibility,
  LIVE_SENDING_RELEASED,
  planIndexNotifications,
  type IndexJobSnapshot,
  type SentNotice,
} from "./plan";

function job(overrides: Partial<IndexJobSnapshot> = {}): IndexJobSnapshot {
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
    ...overrides,
  };
}

function sent(overrides: Partial<SentNotice> = {}): SentNotice {
  const current = job();
  return {
    url: canonicalJobUrl(current),
    jobId: current.id,
    type: "URL_UPDATED",
    fingerprint: indexFingerprint(current),
    sentAt: "2026-11-13T00:00:00.000Z",
    ...overrides,
  };
}

test("visibility follows the public job page", () => {
  assert.equal(indexVisibility({ status: "published", onNiche: true, live: true, jobPosting: true }), "job_posting");
  assert.equal(indexVisibility({ status: "published", onNiche: true, live: false, jobPosting: false }), "noindex");
  assert.equal(indexVisibility({ status: "pending_review", onNiche: true, live: true, jobPosting: false }), "gone");
  assert.equal(indexVisibility({ status: "published", onNiche: false, live: true, jobPosting: true }), "gone");
  assert.equal(
    indexVisibility({ status: "published", onNiche: true, live: true, jobPosting: false }),
    "public_without_posting",
  );
});

test("live sending stays off in this release", () => {
  assert.equal(LIVE_SENDING_RELEASED, false);
  assert.equal(googleIndexingLiveEnabled(), false);
  const route = readFileSync(new URL("../../app/api/cron/google-indexing/route.ts", import.meta.url), "utf8");
  assert.equal(route.includes(".insert("), false);
  assert.equal(route.includes(".update("), false);
  assert.equal(route.includes(".delete("), false);
  assert.equal(route.includes("indexing.googleapis"), false);
  assert.equal(route.includes("searchParams.get(\"secret\")"), false);
  assert.match(route, /Bearer /);
  const workflow = readFileSync(new URL("../../../.github/workflows/careerspal-greenhouse-daily.yml", import.meta.url), "utf8");
  const indexing = workflow.slice(workflow.indexOf("run_indexing_dry_run()"), workflow.indexOf("failed=0"));
  assert.equal((workflow.match(/run_liveness \|\|/g) || []).length, 1);
  assert.match(indexing, /Authorization: Bearer \$CRON_SECRET/);
  assert.equal(indexing.includes("secret="), false);
  assert.match(workflow, /api\/cron\/stale-jobs/);
});

test("canonical job URLs use www", () => {
  assert.equal(
    canonicalJobUrl(job()),
    "https://www.careerspal.com/jobs/revenue-operations-manager--job-1",
  );
});

test("first run backfills current job postings and does not invent deletions", () => {
  const plan = planIndexNotifications({
    jobs: [job(), job({ id: "job-2", title: "Product Operations Manager" })],
    jobsReadOk: true,
    scanComplete: true,
    history: [],
    historyReadOk: true,
    sentToday: 0,
  });
  assert.equal(plan.aborted, null);
  assert.equal(plan.liveSending, false);
  assert.equal(plan.totalUpdated, 2);
  assert.equal(plan.totalDeleted, 0);
  assert.equal(plan.updated.every((item) => item.url.startsWith("https://www.careerspal.com/jobs/")), true);
});

test("an unchanged posting is not queued again", () => {
  const plan = planIndexNotifications({
    jobs: [job()],
    jobsReadOk: true,
    scanComplete: true,
    history: [sent()],
    historyReadOk: true,
    sentToday: 1,
  });
  assert.equal(plan.totalUpdated, 0);
  assert.equal(plan.totalDeleted, 0);
  assert.equal(plan.skippedUnchanged, 1);
});

test("salary, location, work mode, and slug changes queue a new update", () => {
  const history = [sent()];
  const base = { jobsReadOk: true, scanComplete: true, history, historyReadOk: true, sentToday: 1 };
  for (const next of [
    job({ salaryMax: 160000, salaryLabel: "$120k–$160k a year" }),
    job({ location: "Canada" }),
    job({ workMode: "Hybrid" }),
    job({ title: "Senior Revenue Operations Manager" }),
    job({ employmentType: "Contract" }),
    job({ applyUrl: "https://jobs.example.com/revops-2" }),
  ]) {
    const plan = planIndexNotifications({ ...base, jobs: [next] });
    assert.equal(plan.totalUpdated, 1, next.title + next.location + next.workMode);
    assert.notEqual(plan.updated[0]?.fingerprint, history[0]?.fingerprint);
  }
});

test("a description-only change is an update, and the same structured fields stay quiet", () => {
  const changed = planIndexNotifications({
    jobs: [job({ description: "Own the weekly forecast and the hiring plan." })],
    jobsReadOk: true,
    scanComplete: true,
    history: [sent()],
    historyReadOk: true,
    sentToday: 1,
  });
  assert.equal(changed.totalUpdated, 1);
  const same = planIndexNotifications({
    jobs: [job({ description: "Own the weekly   forecast." })],
    jobsReadOk: true,
    scanComplete: true,
    history: [sent()],
    historyReadOk: true,
    sentToday: 1,
  });
  assert.equal(same.totalUpdated, 0);
});

test("a removed or noindex job deletes only a URL we already announced", () => {
  const gone = planIndexNotifications({
    jobs: [job({ visibility: "gone" })],
    jobsReadOk: true,
    scanComplete: true,
    history: [sent()],
    historyReadOk: true,
    sentToday: 1,
  });
  assert.equal(gone.totalDeleted, 1);
  assert.equal(gone.totalUpdated, 0);
  const missing = planIndexNotifications({
    jobs: [job({ id: "other", title: "Other role" })],
    jobsReadOk: true,
    scanComplete: true,
    history: [sent()],
    historyReadOk: true,
    sentToday: 1,
  });
  assert.equal(missing.totalDeleted, 1);
  const neverSent = planIndexNotifications({
    jobs: [],
    jobsReadOk: true,
    scanComplete: true,
    history: [],
    historyReadOk: true,
    sentToday: 0,
  });
  assert.equal(neverSent.totalDeleted, 0);
});

test("noindex deletes, a still-public page without JobPosting does not", () => {
  const noindex = planIndexNotifications({
    jobs: [job({ visibility: "noindex" })],
    jobsReadOk: true,
    scanComplete: true,
    history: [sent()],
    historyReadOk: true,
    sentToday: 1,
  });
  assert.equal(noindex.totalDeleted, 1);
  const publicPage = planIndexNotifications({
    jobs: [job({ visibility: "public_without_posting" })],
    jobsReadOk: true,
    scanComplete: true,
    history: [sent()],
    historyReadOk: true,
    sentToday: 1,
  });
  assert.equal(publicPage.totalDeleted, 0);
  assert.equal(publicPage.totalUpdated, 0);
});

test("a title change updates the new canonical URL and keeps the old alias", () => {
  const plan = planIndexNotifications({
    jobs: [job({ title: "Senior Revenue Operations Manager" })],
    jobsReadOk: true,
    scanComplete: true,
    history: [sent()],
    historyReadOk: true,
    sentToday: 1,
  });
  assert.equal(plan.totalUpdated, 1);
  assert.match(plan.updated[0]?.url || "", /senior-revenue-operations-manager--job-1$/);
  assert.equal(plan.totalDeleted, 0);
});

test("a failed or empty read never queues a deletion", () => {
  const history = [sent()];
  for (const input of [
    { jobs: null, jobsReadOk: false, scanComplete: false },
    { jobs: [], jobsReadOk: true, scanComplete: true },
    { jobs: [job({ visibility: "gone" })], jobsReadOk: true, scanComplete: false },
  ]) {
    const plan = planIndexNotifications({
      ...input,
      history,
      historyReadOk: input.jobsReadOk,
      sentToday: 1,
    });
    assert.equal(plan.totalDeleted, 0);
    assert.equal(plan.deleted.length, 0);
  }
});

test("missing notification history is not a successful backfill", () => {
  const plan = planIndexNotifications({
    jobs: [job()],
    jobsReadOk: true,
    scanComplete: true,
    history: null,
    historyReadOk: false,
    sentToday: 0,
  });
  assert.equal(plan.aborted, "notifications_unavailable");
  assert.equal(plan.totalUpdated, 0);
  assert.equal(plan.totalDeleted, 0);
  assert.equal(plan.liveSending, false);
});

test("the batch stays inside the daily quota and the per-run cap", () => {
  const jobs = Array.from({ length: 50 }, (_item, index) => job({ id: `job-${index}`, title: `Role ${index}` }));
  const capped = planIndexNotifications({
    jobs,
    jobsReadOk: true,
    scanComplete: true,
    history: [],
    historyReadOk: true,
    sentToday: 0,
    dailyQuota: 200,
    perRunCap: 40,
  });
  assert.equal(capped.totalUpdated, 50);
  assert.equal(capped.batchUpdated, 40);
  assert.equal(capped.deferred, 10);
  const nearQuota = planIndexNotifications({
    jobs,
    jobsReadOk: true,
    scanComplete: true,
    history: [],
    historyReadOk: true,
    sentToday: 190,
    dailyQuota: 200,
    perRunCap: 40,
  });
  assert.equal(nearQuota.batchUpdated, 10);
  assert.equal(nearQuota.deferred, 40);
});
