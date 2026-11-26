import assert from "node:assert/strict";
import test from "node:test";
import { acceptHomeResponse, homeViewerTier, jobsForHomeViewer, nextHomeSync, type HomeSync } from "./homeBoardSync";

const now = Date.parse("2026-11-26T20:00:00.000Z");
const early = { id: "early", publishedAt: "2026-11-26T12:00:00.000Z" };
const open = { id: "open", publishedAt: "2026-11-20T12:00:00.000Z" };
const cards = [early, open];

function settle(sync: HomeSync, tier: "guest" | "registered" | "paid", initial: "guest" | "registered" | "paid") {
  return nextHomeSync(sync, tier, initial);
}

test("refresh keeps the server list for a guest, free account, and Premium", () => {
  for (const tier of ["guest", "registered", "paid"] as const) {
    const first = settle({ tier: null, request: 0 }, tier, tier);
    assert.equal(first.fetch, false);
    assert.equal(first.sync.request, 0);
  }
});

test("anonymous to free and anonymous to Premium fetch the account list", () => {
  let sync = settle({ tier: null, request: 0 }, "guest", "guest").sync;
  const free = settle(sync, "registered", "guest");
  assert.equal(free.fetch, true);
  assert.equal(homeViewerTier("token", { role: "candidate" }), "registered");
  sync = free.sync;
  const premium = settle(sync, "paid", "guest");
  assert.equal(premium.fetch, true);
  assert.equal(homeViewerTier("token", { role: "candidate", premiumUntil: new Date(Date.now() + 86_400_000).toISOString() }), "paid");
});

test("Premium sign-out and a downgrade to Free hide early roles immediately", () => {
  assert.deepEqual(jobsForHomeViewer(cards, "paid", now).map((job) => job.id), ["early", "open"]);
  assert.deepEqual(jobsForHomeViewer(cards, "guest", now).map((job) => job.id), ["open"]);
  assert.deepEqual(jobsForHomeViewer(cards, "registered", now).map((job) => job.id), ["open"]);
  const sync = settle({ tier: null, request: 0 }, "paid", "paid").sync;
  const signedOut = settle(sync, "guest", "paid");
  assert.equal(signedOut.fetch, true);
  const downgraded = settle(sync, "registered", "paid");
  assert.equal(downgraded.fetch, true);
});

test("a late Premium response cannot replace the list after sign-out", () => {
  let sync = settle({ tier: null, request: 0 }, "guest", "guest").sync;
  const signingIn = settle(sync, "paid", "guest");
  sync = signingIn.sync;
  const premiumRequest = sync.request;
  const signedOut = settle(sync, "guest", "guest");
  sync = signedOut.sync;
  assert.equal(acceptHomeResponse(sync, premiumRequest, "paid"), false);
  assert.equal(acceptHomeResponse(sync, sync.request, "guest"), true);
  assert.equal(acceptHomeResponse({ tier: "guest", request: sync.request + 1 }, sync.request, "guest"), false);
});
