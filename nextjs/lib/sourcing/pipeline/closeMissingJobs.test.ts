import assert from "node:assert/strict";
import test from "node:test";
import { boardCloseProtectsEmployer, closeJobsMissingFromBoard, SOURCED_REOPEN_STATUSES } from "./closeMissingJobs";

type UpdateCall = { table: string; payload: Record<string, unknown> };

function fakeSb(opts: {
  previousRuns?: Array<{ id: string; fetched_count: number }>;
  candidatesError?: { message: string };
  candidates?: Array<Record<string, unknown>>;
  jobs?: Array<Record<string, unknown>>;
  missingOrigin?: boolean;
  updates?: UpdateCall[];
}) {
  const updates = opts.updates || [];
  return {
    from(table: string) {
      let selected = "";
      const q: {
        select: (cols?: string) => typeof q;
        eq: () => typeof q;
        not: () => typeof q;
        in: () => typeof q;
        neq: () => typeof q;
        order: () => typeof q;
        limit: () => typeof q;
        maybeSingle: () => Promise<{ data: unknown; error: unknown }>;
        update: (payload: Record<string, unknown>) => typeof q;
        then: (onFulfilled: (value: { data: unknown; error: unknown }) => unknown) => Promise<unknown>;
      } = {
        select: (cols?: string) => {
          if (typeof cols === "string") selected = cols;
          return q;
        },
        eq: () => q,
        not: () => q,
        in: () => q,
        neq: () => q,
        order: () => q,
        limit: () => q,
        maybeSingle: () => {
          if (table === "jobs") return Promise.resolve({ data: (opts.jobs || [])[0] || null, error: null });
          return Promise.resolve({ data: null, error: null });
        },
        update: (payload: Record<string, unknown>) => {
          updates.push({ table, payload });
          return q;
        },
        then: (onFulfilled) => {
          if (table === "sourcing_source_runs") {
            return Promise.resolve({ data: opts.previousRuns || [], error: null }).then(onFulfilled);
          }
          if (table === "sourcing_sourced_job_candidates") {
            if (opts.candidatesError) {
              return Promise.resolve({ data: null, error: opts.candidatesError }).then(onFulfilled);
            }
            return Promise.resolve({ data: opts.candidates || [], error: null }).then(onFulfilled);
          }
          if (table === "jobs") {
            if (opts.missingOrigin && selected.includes("origin")) {
              return Promise.resolve({ data: null, error: { message: "column jobs.origin does not exist" } }).then(onFulfilled);
            }
            return Promise.resolve({ data: opts.jobs || [], error: null }).then(onFulfilled);
          }
          return Promise.resolve({ data: [], error: null }).then(onFulfilled);
        },
      };
      return q;
    },
  };
}

test("a failed ATS request never loads listings to close", async () => {
  const updates: UpdateCall[] = [];
  const out = await closeJobsMissingFromBoard(
    fakeSb({ previousRuns: [{ id: "prev", fetched_count: 18 }], updates }) as never,
    {
      sourceId: "src-1",
      runId: "run-bad",
      status: "failed",
      fetchedCount: 0,
      error: "Greenhouse list failed (503)",
      externalIds: [],
    },
  );
  assert.equal(out.breaker, "upstream_error");
  assert.equal(out.closed, 0);
  assert.equal(updates.length, 0);
});

test("a collapsed healthy-looking count still does not close jobs", async () => {
  const updates: UpdateCall[] = [];
  const out = await closeJobsMissingFromBoard(
    fakeSb({ previousRuns: [{ id: "prev", fetched_count: 40 }], updates }) as never,
    {
      sourceId: "src-1",
      runId: "run-now",
      status: "success",
      fetchedCount: 8,
      externalIds: ["1", "2", "3", "4", "5", "6", "7", "8"],
    },
  );
  assert.equal(out.breaker, "count_collapse");
  assert.equal(out.closed, 0);
  assert.equal(updates.length, 0);
});

test("success without live IDs is treated as incomplete, not a mass close", async () => {
  const updates: UpdateCall[] = [];
  const out = await closeJobsMissingFromBoard(
    fakeSb({ previousRuns: [{ id: "prev", fetched_count: 12 }], updates }) as never,
    {
      sourceId: "src-1",
      status: "success",
      fetchedCount: 12,
      externalIds: [],
    },
  );
  assert.equal(out.breaker, "incomplete_response");
  assert.equal(out.closed, 0);
});

test("a second healthy miss inside 12 hours does not close", async () => {
  const updates: UpdateCall[] = [];
  const out = await closeJobsMissingFromBoard(
    fakeSb({
      previousRuns: [{ id: "prev", fetched_count: 2 }],
      candidates: [
        {
          id: "c-src",
          external_job_id: "gone",
          published_job_id: "j-src",
          missing_board_streak: 1,
          missing_board_streak_at: new Date().toISOString(),
          publish_notes: null,
        },
      ],
      jobs: [{ id: "j-src", status: "published", origin: "greenhouse", plan_price: null, stripe_payment_status: null }],
      updates,
    }) as never,
    {
      sourceId: "src-1",
      runId: "run-now",
      status: "success",
      fetchedCount: 2,
      detailFailures: 0,
      externalIds: ["still-1", "still-2"],
    },
  );
  assert.equal(out.closed, 0);
  assert.equal(updates.filter((u) => u.payload.status === "closed").length, 0);
});

test("detail failures do not close jobs", async () => {
  const updates: UpdateCall[] = [];
  const out = await closeJobsMissingFromBoard(
    fakeSb({ previousRuns: [{ id: "prev", fetched_count: 2 }], updates }) as never,
    {
      sourceId: "src-1",
      status: "partial",
      fetchedCount: 2,
      detailFailures: 1,
      externalIds: ["only-one"],
    },
  );
  assert.equal(out.breaker, "incomplete_response");
  assert.equal(out.closed, 0);
  assert.equal(updates.length, 0);
});

const eligibleCandidate = {
  id: "c1",
  external_job_id: "101",
  published_job_id: "j1",
  missing_board_streak: 2,
  missing_board_streak_at: new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString(),
  publish_notes: "closed_from_board: missing from consecutive healthy ATS fetches.",
  source_type: "ashby",
  title: "Revenue Operations Manager",
  location_text: "Remote - US",
  remote_policy: "Remote",
  description_clean: "Revenue operations scope. ".repeat(40),
  salary_present: true,
  salary_amount_min: 90000,
  salary_amount_max: 120000,
  salary_currency: "USD",
  salary_period: "year",
  apply_url: "mailto:jobs@example.com",
  sourcing_candidate_scores: { score_total: 90 },
  sourcing_candidate_decisions: { decision: "auto_publish_candidate" },
};

test("two healthy misses close a sourced job and skip paid employer ads", async () => {
  const updates: UpdateCall[] = [];
  const out = await closeJobsMissingFromBoard(
    fakeSb({
      previousRuns: [{ id: "prev", fetched_count: 3 }],
      candidates: [
        {
          id: "c-src",
          external_job_id: "gone",
          published_job_id: "j-src",
          missing_board_streak: 1,
          missing_board_streak_at: new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString(),
          publish_notes: null,
        },
        { id: "c-paid", external_job_id: "paid", published_job_id: "j-paid", missing_board_streak: 4, publish_notes: null },
      ],
      jobs: [
        { id: "j-src", status: "published", origin: "greenhouse", plan_price: null, stripe_payment_status: null },
        { id: "j-paid", status: "published", origin: "employer", plan_price: 99, stripe_payment_status: "paid" },
      ],
      updates,
    }) as never,
    {
      sourceId: "src-1",
      runId: "run-now",
      status: "success",
      fetchedCount: 2,
      externalIds: ["still-1", "still-2"],
    },
  );
  assert.equal(out.breaker, null);
  assert.equal(out.closed, 1);
  assert.equal(out.skipped, 1);
  assert.equal(updates.filter((u) => u.table === "jobs" && u.payload.status === "closed").length, 1);
});

test("a board-closed job reopens when it returns, without rewriting history timestamps in notes", async () => {
  const updates: UpdateCall[] = [];
  const out = await closeJobsMissingFromBoard(
    fakeSb({
      previousRuns: [{ id: "prev", fetched_count: 2 }],
      candidates: [eligibleCandidate],
      jobs: [
        {
          id: "j1",
          status: "closed",
          origin: "ashby",
          plan_price: null,
          stripe_payment_status: null,
          apply_url: "mailto:jobs@example.com",
        },
      ],
      updates,
    }) as never,
    {
      sourceId: "src-1",
      status: "success",
      fetchedCount: 1,
      externalIds: ["101"],
    },
  );
  assert.equal(out.reopened, 1);
  const jobUpdate = updates.find((u) => u.table === "jobs");
  assert.equal(jobUpdate?.payload.status, "published");
  assert.equal(jobUpdate?.payload.unpublished_at, null);
  const candidate = updates.find((u) => u.table === "sourcing_sourced_job_candidates");
  assert.match(String(candidate?.payload.publish_notes), /timestamp unchanged/i);
});

test("a missing origin column still closes an auto-published ATS job", async () => {
  const updates: UpdateCall[] = [];
  const out = await closeJobsMissingFromBoard(
    fakeSb({
      previousRuns: [{ id: "prev", fetched_count: 2 }],
      missingOrigin: true,
      candidates: [
        {
          id: "c-src",
          external_job_id: "gone",
          published_job_id: "j-src",
          publish_status: "auto_published",
          missing_board_streak: 1,
          missing_board_streak_at: new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString(),
          publish_notes: null,
        },
      ],
      jobs: [{
        id: "j-src",
        status: "published",
        plan_price: null,
        stripe_payment_status: null,
        apply_url: "https://boards.greenhouse.io/acme/jobs/1",
      }],
      updates,
    }) as never,
    {
      sourceId: "src-1",
      runId: "run-now",
      status: "success",
      fetchedCount: 1,
      externalIds: ["still-1"],
    },
  );
  assert.equal(out.breaker, null);
  assert.equal(out.closed, 1);
  assert.equal(updates.filter((u) => u.table === "jobs" && u.payload.status === "closed").length, 1);
});

test("missing origin does not turn a duplicate or an employer listing into an ATS close", () => {
  assert.equal(
    boardCloseProtectsEmployer({ plan_price: null, stripe_payment_status: null }, "auto_published"),
    true,
  );
  assert.equal(
    boardCloseProtectsEmployer(
      { plan_price: null, stripe_payment_status: null, apply_url: "https://boards.greenhouse.io/acme/jobs/1" },
      "auto_published",
    ),
    false,
  );
  assert.equal(
    boardCloseProtectsEmployer(
      { plan_price: null, stripe_payment_status: null, apply_url: "https://example.com/employer-role" },
      "auto_published",
    ),
    true,
  );
  assert.equal(
    boardCloseProtectsEmployer({ plan_price: null, stripe_payment_status: null }, "skipped_duplicate"),
    true,
  );
  assert.equal(
    boardCloseProtectsEmployer({ origin: "employer", plan_price: null, stripe_payment_status: null }, "auto_published"),
    true,
  );
  assert.equal(
    boardCloseProtectsEmployer({ origin: "ashby", plan_price: null, stripe_payment_status: null }, "auto_published"),
    false,
  );
  assert.equal(boardCloseProtectsEmployer({ plan_price: 0, stripe_payment_status: null }, "auto_published"), true);
  assert.equal(
    boardCloseProtectsEmployer({ plan_price: 79, stripe_payment_status: "paid" }, "auto_published"),
    true,
  );
  assert.equal(boardCloseProtectsEmployer({ plan_price: null }, "auto_published", false), true);
  assert.equal(
    boardCloseProtectsEmployer({ plan_price: null, stripe_payment_status: null }, "not_published"),
    true,
  );
  assert.equal(boardCloseProtectsEmployer({ plan_price: null, stripe_payment_status: null }), true);
});

test("a returned US hybrid reopens, and a returned onsite role stays unpublished", async () => {
  const hybridUpdates: UpdateCall[] = [];
  const hybrid = await closeJobsMissingFromBoard(
    fakeSb({
      previousRuns: [{ id: "prev", fetched_count: 1 }],
      candidates: [{ ...eligibleCandidate, id: "c-hybrid", location_text: "New York, NY", remote_policy: "Hybrid" }],
      jobs: [{ id: "j1", status: "closed", origin: "ashby", plan_price: null, stripe_payment_status: null, apply_url: "mailto:jobs@example.com" }],
      updates: hybridUpdates,
    }) as never,
    { sourceId: "src-1", status: "success", fetchedCount: 1, externalIds: ["101"] },
  );
  assert.equal(hybrid.reopened, 1);
  assert.equal(hybridUpdates.find((u) => u.table === "jobs")?.payload.status, "published");

  const onsiteUpdates: UpdateCall[] = [];
  const onsite = await closeJobsMissingFromBoard(
    fakeSb({
      previousRuns: [{ id: "prev", fetched_count: 1 }],
      candidates: [{ ...eligibleCandidate, id: "c-onsite", location_text: "New York, NY", remote_policy: "" }],
      jobs: [{ id: "j1", status: "closed", origin: "ashby", plan_price: null, stripe_payment_status: null, apply_url: "mailto:jobs@example.com" }],
      updates: onsiteUpdates,
    }) as never,
    { sourceId: "src-1", status: "success", fetchedCount: 1, externalIds: ["101"] },
  );
  assert.equal(onsite.reopened, 0);
  assert.equal(onsite.held, 1);
  assert.equal(onsiteUpdates.find((u) => u.table === "jobs")?.payload.status, "pending_review");
});

test("a returned role that fails salary-first stays unpublished", async () => {
  const updates: UpdateCall[] = [];
  const out = await closeJobsMissingFromBoard(
    fakeSb({
      previousRuns: [{ id: "prev", fetched_count: 1 }],
      candidates: [{ ...eligibleCandidate, salary_present: false, salary_amount_min: null, salary_amount_max: null }],
      jobs: [{ id: "j1", status: "closed", origin: "ashby", plan_price: null, stripe_payment_status: null }],
      updates,
    }) as never,
    {
      sourceId: "src-1",
      status: "success",
      fetchedCount: 1,
      detailFailures: 0,
      externalIds: ["101"],
    },
  );
  assert.equal(out.reopened, 0);
  assert.equal(out.held, 1);
  assert.equal(updates.find((u) => u.table === "jobs")?.payload.status, "pending_review");
});

test("a nightly refresh cannot publish pending_review or rejected listings again", () => {
  const allowed = new Set<string>(SOURCED_REOPEN_STATUSES);
  assert.equal(allowed.has("pending_review"), false);
  assert.equal(allowed.has("rejected"), false);
  assert.equal(allowed.has("closed"), true);
});
