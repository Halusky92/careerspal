import assert from "node:assert/strict";
import test from "node:test";
import { isEmployerManagedOrigin, isSourcedJobOrigin, sourcedOriginFromSourceType } from "./origin";

test("source_type maps to jobs.origin", () => {
  assert.equal(sourcedOriginFromSourceType("ashby"), "ashby");
  assert.equal(sourcedOriginFromSourceType("lever"), "lever");
  assert.equal(sourcedOriginFromSourceType("greenhouse"), "greenhouse");
  assert.equal(sourcedOriginFromSourceType("direct_custom"), "sourced");
});

test("employer listings stay distinct from ATS origins", () => {
  assert.equal(isSourcedJobOrigin("employer"), false);
  assert.equal(isSourcedJobOrigin("ashby"), true);
  assert.equal(isEmployerManagedOrigin("employer"), true);
  assert.equal(isEmployerManagedOrigin(null), true);
  assert.equal(isEmployerManagedOrigin("lever"), false);
});
