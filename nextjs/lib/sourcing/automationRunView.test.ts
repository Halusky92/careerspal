import assert from "node:assert/strict";
import test from "node:test";
import fs from "fs";
import path from "path";
import { automationRunView } from "./automationRunView";
import { SLICE_BUDGET_MS } from "./pipeline/slice";

test("a pipeline row shows rejection reasons and filled salaries without turning a missing split into zero", () => {
  const viewed = automationRunView({
    id: "run-1",
    actor_id: null,
    created_at: "2026-11-10T00:24:00.000Z",
    metadata: {
      trigger: "github",
      sources_processed: 1,
      raw_fetched: 10,
      raw_inserted: 1,
      normalization: { processed: 1, inserted: 1, updated: 0, skipped: 0, errors: 0 },
      evaluation: { processed: 1, evaluated: 1, errors: 0 },
      salary_enrichment: { updated: 1, not_found: 2, failed: 0 },
      freshness: { updated: 3 },
      close_from_board: { closed: 0 },
      auto_publish: {
        published: 1,
        skipped_total: 2,
        skipped_duplicates: 0,
        skipped_not_eligible: 2,
        reasons: { salary_missing: 1, off_niche_title: 1 },
      },
    },
  });
  assert.equal(viewed.autoPublish.reasons.salary_missing, 1);
  assert.equal(viewed.autoPublish.reasons.off_niche_title, 1);
  assert.equal(viewed.salary?.updated, 1);
  assert.equal(viewed.salary?.notFound, 2);
  assert.equal(viewed.freshnessUpdated, 3);
  assert.equal(viewed.closed, 0);

  const older = automationRunView({
    id: "run-old",
    actor_id: null,
    created_at: "2026-11-10T00:24:00.000Z",
    metadata: { auto_publish: { skipped_not_eligible: 181, published: 1 } },
  });
  assert.equal(older.autoPublish.reasons, null);
  assert.equal(older.salary, null);
  assert.equal(older.closed, null);
});

test("a slice finishes inside the Vercel limit and GitHub does not use one long request", () => {
  assert.ok(60_000 - SLICE_BUDGET_MS >= 10_000);
  const workflow = fs.readFileSync(path.join(process.cwd(), "../.github/workflows/careerspal-greenhouse-daily.yml"), "utf8");
  const active = fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8");
  const adminRoute = fs.readFileSync(path.join(process.cwd(), "app/api/admin/sourcing/pipeline/greenhouse/route.ts"), "utf8");
  assert.match(workflow, /--max-time 70/);
  assert.doesNotMatch(workflow, /--max-time 900/);
  assert.doesNotMatch(workflow, /cron:/);
  assert.match(workflow, /workflow_dispatch/);
  assert.match(workflow, /for i in 1 2 3/);
  assert.doesNotMatch(active, /pipeline\/greenhouse/);
  assert.match(active, /stale-jobs/);
  assert.match(adminRoute, /maxDuration = 60/);
});
