import assert from "node:assert/strict";
import test from "node:test";
import {
  assessBoardFetchHealth,
  boardHealthReason,
  CLOSE_STREAK_REQUIRED,
  planBoardClosures,
  type BoardListing,
} from "./boardHealth";

const listing = (over: Partial<BoardListing> = {}): BoardListing => ({
  candidateId: "c1",
  jobId: "j1",
  externalJobId: "101",
  streak: 0,
  jobStatus: "published",
  closedByBoard: false,
  paidEmployer: false,
  ...over,
});

test("healthy fetch with a stable count may inspect missing jobs", () => {
  assert.deepEqual(
    assessBoardFetchHealth({ status: "success", fetchedCount: 12, previousSuccessFetchedCount: 14 }),
    { ok: true },
  );
});

test("5xx, rate limit, timeout and failed ingest trip the circuit breaker", () => {
  assert.equal(assessBoardFetchHealth({ status: "failed", fetchedCount: 12, error: "Greenhouse list failed (500)" }).ok, false);
  assert.equal(assessBoardFetchHealth({ status: "success", fetchedCount: 12, error: "429 Too Many Requests" }).ok, false);
  assert.equal(assessBoardFetchHealth({ status: "success", fetchedCount: 12, timedOut: true }).ok, false);
  assert.equal(
    boardHealthReason(assessBoardFetchHealth({ status: "failed", fetchedCount: 0, error: "timeout" })),
    "upstream_error",
  );
});

test("empty or collapsed boards do not close jobs", () => {
  assert.equal(
    boardHealthReason(assessBoardFetchHealth({ status: "success", fetchedCount: 0, previousSuccessFetchedCount: 20 })),
    "empty_after_nonempty",
  );
  assert.equal(
    boardHealthReason(assessBoardFetchHealth({ status: "success", fetchedCount: 4, previousSuccessFetchedCount: 20 })),
    "count_collapse",
  );
  assert.equal(boardHealthReason(assessBoardFetchHealth({ status: "success", fetchedCount: 0 })), "empty_fetch");
});

test("incomplete live IDs never become a close set", () => {
  assert.equal(
    boardHealthReason(
      assessBoardFetchHealth({ status: "success", fetchedCount: 12, liveIdCount: 0 }),
    ),
    "incomplete_response",
  );
  assert.equal(
    boardHealthReason(
      assessBoardFetchHealth({ status: "success", fetchedCount: 12, liveIdCount: 7 }),
    ),
    "incomplete_response",
  );
  assert.equal(assessBoardFetchHealth({ status: "success", fetchedCount: 12, liveIdCount: 12 }).ok, true);
});

test("a tripped breaker yields zero close actions", () => {
  const plan = planBoardClosures({
    health: { ok: false, reason: "upstream_error" },
    liveExternalIds: [],
    listings: [listing({ streak: 5 }), listing({ candidateId: "c2", jobId: "j2", externalJobId: "202", streak: 5 })],
  });
  assert.equal(plan.breaker, "upstream_error");
  assert.equal(plan.actions.length, 0);
});

test("first miss only records a streak; a second miss inside 12 hours does not close", () => {
  const now = Date.parse("2026-11-09T20:00:00.000Z");
  const first = planBoardClosures({
    health: { ok: true },
    liveExternalIds: ["999"],
    listings: [listing({ streak: 0 })],
    nowMs: now,
  });
  assert.equal(first.actions[0]?.type, "miss");
  assert.equal(first.actions[0]?.nextStreak, 1);
  const soon = planBoardClosures({
    health: { ok: true },
    liveExternalIds: ["999"],
    listings: [listing({ streak: 1, lastMissAt: new Date(now - 15 * 60 * 1000).toISOString() })],
    nowMs: now,
  });
  assert.equal(soon.actions[0]?.type, "wait");
  assert.equal(soon.actions[0]?.nextStreak, 1);
  const later = planBoardClosures({
    health: { ok: true },
    liveExternalIds: ["999"],
    listings: [listing({ streak: 1, lastMissAt: new Date(now - 13 * 60 * 60 * 1000).toISOString() })],
    nowMs: now,
  });
  assert.equal(later.actions[0]?.type, "close");
  assert.equal(later.actions[0]?.nextStreak, CLOSE_STREAK_REQUIRED);
});

test("detail failures and partial fetches are not a complete check", () => {
  assert.equal(
    boardHealthReason(assessBoardFetchHealth({ status: "success", fetchedCount: 12, detailFailures: 2 })),
    "incomplete_response",
  );
  assert.equal(
    boardHealthReason(assessBoardFetchHealth({ status: "partial", fetchedCount: 12, detailFailures: 0 })),
    "incomplete_response",
  );
});

test("a job that returns to the board reopens only board-closed listings", () => {
  const reopen = planBoardClosures({
    health: { ok: true },
    liveExternalIds: ["101"],
    listings: [listing({ jobStatus: "closed", closedByBoard: true, streak: 2 })],
  });
  assert.equal(reopen.actions[0]?.type, "reopen");
  const qualityHold = planBoardClosures({
    health: { ok: true },
    liveExternalIds: ["101"],
    listings: [listing({ jobStatus: "pending_review", closedByBoard: false, streak: 2 })],
  });
  assert.equal(qualityHold.actions[0]?.type, "seen");
});

test("paid employer listings are never closed from an ATS board", () => {
  const plan = planBoardClosures({
    health: { ok: true },
    liveExternalIds: [],
    listings: [listing({ paidEmployer: true, streak: 4 })],
  });
  assert.equal(plan.actions.length, 0);
});
