import assert from "node:assert/strict";
import test from "node:test";
import { usMarketEligibility } from "./usMarket";

test("Remote within Canada or United States stays open to a US applicant", () => {
  assert.equal(
    usMarketEligibility("San Francisco, CA, New York, NY, Portland, OR, or Remote within Canada or United States", "Remote", ""),
    "us",
  );
});

test("the pronoun us does not confirm a US remote role", () => {
  assert.equal(
    usMarketEligibility("", "Remote", "Join us. This is a fully remote role and we can't wait to welcome you."),
    "unconfirmed",
  );
});

test("an office city in the description does not confirm a blank location", () => {
  assert.equal(
    usMarketEligibility("", "Remote", "We have offices located in San Francisco, New York, and Pittsburgh."),
    "unconfirmed",
  );
});

test("must be based in the United States confirms a remote role with a blank location", () => {
  assert.equal(usMarketEligibility("", "Remote", "This role is remote and you must be based in the United States."), "us");
});

test("Cambridge, MA in the location line confirms the United States", () => {
  assert.equal(usMarketEligibility("", "Remote", "Location: Remote, or hybrid in Cambridge, MA if you're local."), "us");
});

test("a United Kingdom remote role stays outside the US", () => {
  assert.equal(usMarketEligibility("London, United Kingdom", "Remote", "Work from the United Kingdom."), "outside_us");
});
