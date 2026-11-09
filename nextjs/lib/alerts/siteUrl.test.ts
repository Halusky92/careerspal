import assert from "node:assert/strict";
import test from "node:test";
import { CANONICAL_ORIGIN, canonicalizePublicOrigin } from "./siteUrl";

test("apex and preview hosts become www.careerspal.com", () => {
  assert.equal(canonicalizePublicOrigin("https://careerspal.com"), CANONICAL_ORIGIN);
  assert.equal(canonicalizePublicOrigin("https://careerspal.com/"), CANONICAL_ORIGIN);
  assert.equal(canonicalizePublicOrigin("https://www.careerspal.com"), CANONICAL_ORIGIN);
  assert.equal(
    canonicalizePublicOrigin("https://careerspal-nxtmcnv2l-halusky92s-projects.vercel.app"),
    CANONICAL_ORIGIN,
  );
});

test("localhost stays local", () => {
  assert.equal(canonicalizePublicOrigin("http://localhost:3000"), "http://localhost:3000");
});
