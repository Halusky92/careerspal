import assert from "node:assert/strict";
import test from "node:test";
import { upsertRawJobsByHash, type RawJobRow } from "./rawIngest";

function row(over: Partial<RawJobRow> = {}): RawJobRow {
  return {
    source_id: "src-1",
    source_run_id: "run-1",
    source_type: "greenhouse",
    source_url: "https://boards.greenhouse.io/acme",
    external_job_id: "101",
    job_url: "https://boards.greenhouse.io/acme/jobs/101",
    title: "RevOps Manager",
    raw_payload: { id: 101, salary: "$120k" },
    payload_hash: "hash-a",
    fetched_at: "2026-11-09T12:00:00.000Z",
    ...over,
  };
}

function fakeSb(existing: Array<{ id: string; external_job_id: string; payload_hash: string | null }>) {
  const upserts: unknown[] = [];
  const seenUpdates: Array<{ ids: string[] }> = [];
  const sb = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                async in() {
                  return { data: existing, error: null };
                },
              };
            },
          };
        },
        async upsert(payload: unknown) {
          upserts.push(payload);
          return { error: null };
        },
        update() {
          return {
            async in(_col: string, ids: string[]) {
              seenUpdates.push({ ids });
              return { error: null };
            },
          };
        },
      };
    },
  };
  return { sb: sb as never, upserts, seenUpdates };
}

test("unchanged Greenhouse payload only bumps last_seen_at", async () => {
  const { sb, upserts, seenUpdates } = fakeSb([{ id: "raw-1", external_job_id: "101", payload_hash: "hash-a" }]);
  const out = await upsertRawJobsByHash(sb, [row()]);
  assert.equal(out.unchanged, 1);
  assert.equal(out.updated, 0);
  assert.equal(out.inserted, 0);
  assert.equal(upserts.length, 0);
  assert.deepEqual(seenUpdates[0]?.ids, ["raw-1"]);
});

test("salary hash change upserts the existing raw job instead of inserting a duplicate", async () => {
  const { sb, upserts, seenUpdates } = fakeSb([{ id: "raw-1", external_job_id: "101", payload_hash: "hash-a" }]);
  const out = await upsertRawJobsByHash(sb, [row({ payload_hash: "hash-b", raw_payload: { id: 101, salary: "$140k" } })]);
  assert.equal(out.updated, 1);
  assert.equal(out.inserted, 0);
  assert.equal(out.unchanged, 0);
  assert.equal(upserts.length, 1);
  assert.equal(seenUpdates.length, 0);
  const payload = (upserts[0] as RawJobRow[])[0];
  assert.equal(payload.external_job_id, "101");
  assert.equal(payload.payload_hash, "hash-b");
});

test("new ATS job ids insert once", async () => {
  const { sb, upserts } = fakeSb([]);
  const out = await upsertRawJobsByHash(sb, [row({ external_job_id: "202", payload_hash: "hash-new" })]);
  assert.equal(out.inserted, 1);
  assert.equal((upserts[0] as RawJobRow[])[0].external_job_id, "202");
});
