import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  applyProbeFromFetchError,
  applyProbeFromStatus,
  applyUrlLooksSourcedAts,
  applyUrlLooksUsable,
  isClosedApplyCopy,
  isSourcedListing,
  isSourcedOrigin,
  shouldSkipLiveProbe,
} from "./applyLinkHealth";
import { shouldLeaveApplyLinkToSourcing } from "./sweepDeadApplyLinks";

test("apply urls must be a real page or mailto", () => {
  assert.equal(applyUrlLooksUsable(""), false);
  assert.equal(applyUrlLooksUsable("#"), false);
  assert.equal(applyUrlLooksUsable("https://stripe.com/jobs/ops"), true);
  assert.equal(applyUrlLooksUsable("jobs.ashbyhq.com/notion/abc"), true);
  assert.equal(applyUrlLooksUsable("mailto:jobs@acme.com"), true);
  assert.equal(shouldSkipLiveProbe("mailto:jobs@acme.com"), true);
});

test("a timeout, 403, or 429 does not close a listing", () => {
  assert.equal(applyProbeFromStatus(403)?.dead, false);
  assert.equal(applyProbeFromStatus(429)?.dead, false);
  assert.equal(applyProbeFromFetchError("The operation was aborted").dead, false);
  assert.equal(applyProbeFromFetchError("getaddrinfo ENOTFOUND jobs.example").dead, true);
});

test("only a GET 404 or 410 confirms the listing is gone", () => {
  const source = readFileSync(new URL("./applyLinkHealth.ts", import.meta.url), "utf8");
  const headBranch = source.slice(source.indexOf("method: \"HEAD\""), source.indexOf("method: \"GET\""));
  assert.equal(headBranch.includes("headProbe?.dead"), false);
  assert.equal(applyProbeFromStatus(404)?.dead, true);
  assert.equal(applyProbeFromStatus(410)?.dead, true);
});

test("closed job pages are detected from copy", () => {
  assert.equal(isClosedApplyCopy("This job is no longer available."), true);
  assert.equal(isClosedApplyCopy("Join our operations team."), false);
});

test("an empty price or owner does not make an employer apply link sourced", () => {
  assert.equal(
    isSourcedListing({ apply_url: "https://example.com/employer-role", plan_price: null }),
    false,
  );
  assert.equal(
    isSourcedListing({
      id: "employer-job",
      apply_url: "https://example.com/employer-role",
      plan_price: null,
      sourcedJobIds: new Set(["employer-job"]),
    }),
    false,
  );
});

test("greenhouse and ashby origins count as sourced", () => {
  assert.equal(isSourcedOrigin("greenhouse"), true);
  assert.equal(isSourcedOrigin("ashby"), true);
  assert.equal(isSourcedOrigin("employer"), false);
  assert.equal(isSourcedOrigin(null), false);
  assert.equal(applyUrlLooksSourcedAts("https://boards.greenhouse.io/acme/jobs/1"), true);
  assert.equal(
    isSourcedListing({ apply_url: "https://jobs.ashbyhq.com/acme/abc", plan_price: null }),
    true,
  );
  assert.equal(
    isSourcedListing({ apply_url: "https://boards.greenhouse.io/acme/jobs/1", plan_price: 0 }),
    false,
  );
  assert.equal(shouldLeaveApplyLinkToSourcing({ apply_url: "https://boards.greenhouse.io/acme/jobs/1", plan_price: 0 }), true);
  assert.equal(shouldLeaveApplyLinkToSourcing({ origin: "ashby", apply_url: "https://example.com/role" }), true);
  assert.equal(shouldLeaveApplyLinkToSourcing({ apply_url: "https://example.com/employer", plan_price: 0 }), false);
  assert.equal(shouldLeaveApplyLinkToSourcing({ apply_url: "https://example.com/employer", plan_price: 49, stripe_payment_status: "paid" }), true);
});
