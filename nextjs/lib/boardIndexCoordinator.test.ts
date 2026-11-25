import assert from "node:assert/strict";
import test from "node:test";
import { coordinateBoardBuild, type BoardSnapshot } from "./boardIndexCoordinator";

type Store = BoardSnapshot<string> & { owner: string | null };

function harness() {
  const store: Store = { payload: null, builtAt: 0, sourceUpdatedAt: null, leaseUntil: 0, owner: null };
  let builds = 0;
  const coordinate = (now: number, sourceUpdatedAt: string | null) =>
    coordinateBoardBuild({
      now,
      sourceUpdatedAt,
      read: async () => ({ ...store }),
      claim: async () => {
        if (store.leaseUntil > now && store.owner) return false;
        store.owner = "builder";
        store.leaseUntil = now + 45_000;
        return true;
      },
      build: async () => {
        builds += 1;
        await new Promise((resolve) => setTimeout(resolve, 30));
        return `index-${builds}`;
      },
      write: async (payload, builtAt, source) => {
        store.payload = payload;
        store.builtAt = builtAt;
        store.sourceUpdatedAt = source;
      },
      release: async () => {
        store.owner = null;
        store.leaseUntil = 0;
      },
      wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      waitMs: 5,
      waitAttempts: 30,
    });
  return { coordinate, builds: () => builds };
}

test("one cold build serves 1, 10, 50 and 100 concurrent readers", async () => {
  for (const readers of [1, 10, 50, 100]) {
    const run = harness();
    const results = await Promise.all(Array.from({ length: readers }, () => run.coordinate(1_000, "2026-11-25T12:00:00.000Z")));
    assert.equal(run.builds(), 1);
    assert.equal(new Set(results.map((result) => result.value)).size, 1);
    assert.equal(results.filter((result) => result.built).length, 1);
  }
});

test("a batch of source changes inside 15 seconds does not rebuild the index", async () => {
  const run = harness();
  await run.coordinate(1_000, "2026-11-25T12:00:00.000Z");
  const again = await Promise.all(
    Array.from({ length: 50 }, () => run.coordinate(5_000, "2026-11-25T12:00:04.000Z")),
  );
  assert.equal(run.builds(), 1);
  assert.equal(again.every((result) => result.built === false), true);
});

test("a failed build releases the lease and the next caller builds", async () => {
  const store: Store = { payload: null, builtAt: 0, sourceUpdatedAt: null, leaseUntil: 0, owner: null };
  let builds = 0;
  let fail = true;
  const coordinate = (now: number) =>
    coordinateBoardBuild({
      now,
      sourceUpdatedAt: "2026-11-25T12:00:00.000Z",
      read: async () => ({ ...store }),
      claim: async () => {
        if (store.leaseUntil > now && store.owner) return false;
        store.owner = "builder";
        store.leaseUntil = now + 45_000;
        return true;
      },
      build: async () => {
        builds += 1;
        if (fail) throw new Error("build failed");
        return "ready";
      },
      write: async (payload, builtAt, source) => {
        if (store.owner !== "builder") throw new Error("lost lease");
        store.payload = payload;
        store.builtAt = builtAt;
        store.sourceUpdatedAt = source;
      },
      release: async () => {
        if (store.owner === "builder") {
          store.owner = null;
          store.leaseUntil = 0;
        }
      },
      wait: async () => {},
    });
  await assert.rejects(() => coordinate(1_000), /build failed/);
  assert.equal(store.owner, null);
  fail = false;
  const next = await coordinate(2_000);
  assert.equal(builds, 2);
  assert.equal(next.value, "ready");
  assert.equal(next.built, true);
});

test("an expired lease can be claimed and a live lease cannot", async () => {
  const store: Store = { payload: "old", builtAt: 1_000, sourceUpdatedAt: "2026-11-25T12:00:00.000Z", leaseUntil: 50_000, owner: "other" };
  const claimAt = async (now: number) => {
    if (store.leaseUntil > now && store.owner) return false;
    store.owner = "next";
    store.leaseUntil = now + 45_000;
    return true;
  };
  assert.equal(await claimAt(10_000), false);
  assert.equal(store.owner, "other");
  assert.equal(await claimAt(50_001), true);
  assert.equal(store.owner, "next");
});

test("after the coalesce window one newer source rebuilds once", async () => {
  const run = harness();
  await run.coordinate(1_000, "2026-11-25T12:00:00.000Z");
  const next = await Promise.all(
    Array.from({ length: 20 }, () => run.coordinate(20_000, "2026-11-25T12:00:20.000Z")),
  );
  assert.equal(run.builds(), 2);
  assert.equal(next.filter((result) => result.built).length, 1);
});
