import assert from "node:assert/strict";
import test from "node:test";
import {
  employerCanEditListingContent,
  patchHasListingContent,
} from "./listingLock";

test("draft and review listings can still be edited", () => {
  assert.equal(employerCanEditListingContent("draft"), true);
  assert.equal(employerCanEditListingContent("pending_review"), true);
});

test("published listings are locked for content edits", () => {
  assert.equal(employerCanEditListingContent("published"), false);
  assert.equal(employerCanEditListingContent("paused"), false);
  assert.equal(employerCanEditListingContent("closed"), false);
  assert.equal(employerCanEditListingContent("archived"), false);
});

test("pause-only payloads are not treated as content edits", () => {
  assert.equal(patchHasListingContent({ action: "pause" }), false);
  assert.equal(patchHasListingContent({ title: "New title" }), true);
});
