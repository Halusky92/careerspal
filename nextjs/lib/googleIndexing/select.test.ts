import assert from "node:assert/strict";
import test from "node:test";
import { toIndexSnapshot } from "./snapshot";
import { HOURLY_EARLY_ACCESS_AUTOMATION, descriptionIdsForRun, leftEarlyAccessWindow, type IndexDigest, type SlimIndexRow } from "./select";

const now = Date.parse("2026-11-26T20:00:00.000Z");

function row(partial: Partial<SlimIndexRow> = {}): SlimIndexRow {
  return {
    id: "job-1",
    title: "Revenue Operations Manager",
    location: "Remote - US",
    remote_policy: "Remote",
    type: "Full-time",
    salary: "$120k–$150k a year",
    timestamp: now - 3 * 24 * 60 * 60 * 1000,
    published_at: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: "2026-11-20T00:00:00.000Z",
    category: "Operations",
    apply_url: "https://jobs.example.com/revops",
    status: "published",
    content_hash: "hash-a",
    companies: { name: "Example" },
    ...partial,
  };
}

test("hourly automation stays off and the window is the hour after Premium", () => {
  assert.equal(HOURLY_EARLY_ACCESS_AUTOMATION, false);
  const justPublic = row({ published_at: new Date(now - 24 * 60 * 60 * 1000 - 30 * 60 * 1000).toISOString() });
  const stillEarly = row({ published_at: new Date(now - 2 * 60 * 60 * 1000).toISOString() });
  assert.equal(leftEarlyAccessWindow(justPublic, now), true);
  assert.equal(leftEarlyAccessWindow(stillEarly, now), false);
});

test("descriptions are skipped for early roles and fresh digests", () => {
  const early = row({ id: "early", published_at: new Date(now - 60 * 60 * 1000).toISOString(), timestamp: now });
  const fresh = row({ id: "fresh" });
  const stale = row({ id: "stale", updated_at: "2026-11-26T00:00:00.000Z" });
  const digest = new Map<string, IndexDigest>([
    ["fresh", {
      jobId: "fresh",
      updatedAt: "2026-11-20T00:00:00.000Z",
      contentHash: "hash-a",
      descriptionSha: "abc",
      visibility: "job_posting",
      early: false,
    }],
  ]);
  const ids = descriptionIdsForRun([early, fresh, stale], digest, now, 10);
  assert.deepEqual(ids, ["stale"]);
});

test("a role without a real JobPosting is not indexed", () => {
  const posted = toIndexSnapshot({
    ...row(),
    description: "Own RevOps systems and reporting.",
  });
  assert.equal(posted.visibility, "job_posting");
  const noCountry = toIndexSnapshot({
    ...row(),
    location: "Remote",
    description: "Own the weekly forecast.",
  });
  assert.equal(noCountry.visibility, "public_without_posting");
  const early = toIndexSnapshot({
    ...row(),
    published_at: new Date(now - 60 * 60 * 1000).toISOString(),
    timestamp: now,
    description: "Own RevOps systems and reporting.",
  });
  assert.equal(early.visibility, "noindex");
});
