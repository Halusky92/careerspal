import assert from "node:assert/strict";
import test from "node:test";
import { companyNameFromBoardTitle, isRawAtsSlug } from "./boardName";

test("board titles become the official company name", () => {
  assert.equal(companyNameFromBoardTitle("Temporal Technologies Jobs"), "Temporal Technologies");
  assert.equal(companyNameFromBoardTitle("PermitFlow Jobs"), "PermitFlow");
  assert.equal(companyNameFromBoardTitle("Jobs at Checkr"), "Checkr");
  assert.equal(companyNameFromBoardTitle("Express Chipping Inc"), "Express Chipping Inc");
  assert.equal(companyNameFromBoardTitle("Vesta Innovations Inc. Jobs"), "Vesta Innovations Inc.");
  assert.equal(companyNameFromBoardTitle("Stripe Careers | Open Roles"), "");
});

test("a raw ATS token is not used as the company name", () => {
  assert.equal(isRawAtsSlug("temporal", "temporal"), true);
  assert.equal(isRawAtsSlug("pomelo-care", "pomelo-care"), true);
  assert.equal(isRawAtsSlug("PermitFlow", "permitflow"), false);
  assert.equal(isRawAtsSlug("Pomelo Care", "pomelo-care"), false);
  assert.equal(isRawAtsSlug("BetterUp", "betterup"), false);
  assert.equal(isRawAtsSlug("Engine", "engine"), false);
  assert.equal(isRawAtsSlug("", "temporal"), true);
});
