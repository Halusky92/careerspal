import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isOwnerAdminEmail } from "./adminAccess";

describe("owner admin emails", () => {
  it("treats the operator Gmail as admin", () => {
    assert.equal(isOwnerAdminEmail("mb.bilek@gmail.com"), true);
    assert.equal(isOwnerAdminEmail("MB.Bilek@gmail.com"), true);
  });

  it("treats the canonical admin mailbox as admin", () => {
    assert.equal(isOwnerAdminEmail("admin@careerspal.com"), true);
  });

  it("does not grant admin to a random employer", () => {
    assert.equal(isOwnerAdminEmail("hiring@company.com"), false);
    assert.equal(isOwnerAdminEmail(""), false);
  });
});
