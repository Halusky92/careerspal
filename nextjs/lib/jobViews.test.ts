import assert from "node:assert/strict";
import test from "node:test";
import { formatJobViews } from "./formatJobViews";
import { uniqueViewerFromRequest } from "./jobViews";

test("formatJobViews uses a real count", () => {
  assert.equal(formatJobViews(undefined), "0 views");
  assert.equal(formatJobViews(1), "1 view");
  assert.equal(formatJobViews(12), "12 views");
});

test("logged-in accounts are unique by user id", () => {
  const a = uniqueViewerFromRequest({ jobId: "job-1", userId: "user-a", sessionId: "sid-1", ip: "1.1.1.1" });
  const b = uniqueViewerFromRequest({ jobId: "job-1", userId: "user-b", sessionId: "sid-1", ip: "1.1.1.1" });
  const again = uniqueViewerFromRequest({ jobId: "job-1", userId: "user-a", sessionId: "sid-9", ip: "9.9.9.9" });
  assert.equal(a.viewerId, "user-a");
  assert.equal(b.viewerId, "user-b");
  assert.notEqual(a.viewerId, b.viewerId);
  assert.equal(again.viewerId, a.viewerId);
});

test("guests without an account are unique by browser session", () => {
  const a = uniqueViewerFromRequest({ jobId: "job-1", sessionId: "sid-a", ip: "1.1.1.1" });
  const b = uniqueViewerFromRequest({ jobId: "job-1", sessionId: "sid-b", ip: "1.1.1.1" });
  const again = uniqueViewerFromRequest({ jobId: "job-1", sessionId: "sid-a", ip: "8.8.8.8" });
  assert.equal(a.viewerId, null);
  assert.equal(a.fingerprint, again.fingerprint);
  assert.notEqual(a.fingerprint, b.fingerprint);
});
