import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { interpretApiFallback, interpretDirectLookup } from "./publicJobLookup";

const hiddenStatuses = ["paused", "draft", "rejected", "pending_review", "private", "closed", "archived"] as const;

for (const status of hiddenStatuses) {
  test(`${status} job is a real miss, not a database outage`, () => {
    const result = interpretDirectLookup({
      jobId: "job_1",
      configured: true,
      row: { id: "job_1", status },
      error: null,
      isPublic: false,
    });
    assert.deepEqual(result, { outcome: "missing" });
  });
}

test("published on-niche job is public even when the listing is no longer live", () => {
  const row = { id: "job_live", status: "published", timestamp: 1 };
  const result = interpretDirectLookup({
    jobId: row.id,
    configured: true,
    row,
    error: null,
    isPublic: true,
  });
  assert.deepEqual(result, { outcome: "found", job: row });
});

test("unknown id and deleted row are misses", () => {
  assert.deepEqual(
    interpretDirectLookup({
      jobId: "missing",
      configured: true,
      row: null,
      error: { code: "PGRST116" },
      isPublic: false,
    }),
    { outcome: "missing" },
  );
  assert.deepEqual(
    interpretDirectLookup({
      jobId: "not-a-uuid",
      configured: true,
      row: null,
      error: { code: "22P02" },
      isPublic: false,
    }),
    { outcome: "missing" },
  );
  assert.deepEqual(
    interpretDirectLookup({
      jobId: null,
      configured: true,
      row: null,
      error: null,
      isPublic: false,
    }),
    { outcome: "missing" },
  );
});

test("a failed database read is not turned into a miss when the API also returns 404", () => {
  const direct = interpretDirectLookup({
    jobId: "job_1",
    configured: true,
    row: null,
    error: { code: "08006" },
    isPublic: false,
  });
  assert.equal(direct.outcome, "retry");
  if (direct.outcome !== "retry") return;
  assert.deepEqual(
    interpretApiFallback({
      reason: direct.reason,
      status: 404,
      job: null,
      isPublic: false,
    }),
    { outcome: "unavailable" },
  );
});

test("API fallback can still recover a public job after a query failure", () => {
  const job = { id: "job_1", status: "published" };
  assert.deepEqual(
    interpretApiFallback({
      reason: "query_failed",
      status: 200,
      job,
      isPublic: true,
    }),
    { outcome: "found", job },
  );
});

test("without a database client, only an explicit API 404 is a miss", () => {
  assert.deepEqual(
    interpretApiFallback({
      reason: "not_configured",
      status: 404,
      job: null,
      isPublic: false,
    }),
    { outcome: "missing" },
  );
  assert.deepEqual(
    interpretApiFallback({
      reason: "not_configured",
      status: 500,
      job: null,
      isPublic: false,
    }),
    { outcome: "unavailable" },
  );
  assert.deepEqual(
    interpretApiFallback({
      reason: "not_configured",
      status: null,
      job: null,
      isPublic: false,
    }),
    { outcome: "unavailable" },
  );
});

test("job detail is outside every loading boundary so notFound can commit HTTP 404", () => {
  const app = path.join(process.cwd(), "app");
  assert.equal(fs.existsSync(path.join(app, "loading.tsx")), false);
  assert.equal(fs.existsSync(path.join(app, "jobs", "loading.tsx")), false);
  assert.equal(fs.existsSync(path.join(app, "jobs", "[slug]", "loading.tsx")), false);
  assert.equal(fs.existsSync(path.join(app, "jobs", "(board)", "loading.tsx")), true);
  assert.equal(fs.existsSync(path.join(app, "(home)", "loading.tsx")), true);

  const page = fs.readFileSync(path.join(app, "jobs", "[slug]", "page.tsx"), "utf8");
  assert.match(page, /notFound\(\)/);
  assert.match(page, /JobLookupUnavailableError/);
  assert.match(page, /interpretDirectLookup/);
  assert.match(page, /interpretApiFallback/);
});
