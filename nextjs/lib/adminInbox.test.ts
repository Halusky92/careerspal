import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { accountAlertRows, guestAlertRows } from "./adminInbox";

describe("admin inbox alert rows", () => {
  it("keeps unconfirmed guest emails visible", () => {
    const rows = guestAlertRows([
      {
        email: "Wait@CareersPal.com",
        preference: JSON.stringify({ confirmed: false, categories: "all", token: "aa" }),
        created_at: "2026-11-01T00:00:00.000Z",
      },
    ]);
    assert.equal(rows[0].email, "wait@careerspal.com");
    assert.equal(rows[0].confirmed, false);
    assert.equal(rows[0].source, "guest");
  });

  it("joins account alerts to profile emails", () => {
    const rows = accountAlertRows(
      [{ user_id: "u1", query: "RevOps", location: "Remote", created_at: "2026-11-02T00:00:00.000Z" }],
      [{ id: "u1", email: "seeker@company.com" }],
    );
    assert.equal(rows[0].email, "seeker@company.com");
    assert.equal(rows[0].source, "account");
    assert.equal(rows[0].confirmed, true);
    assert.match(rows[0].label, /RevOps/);
  });
});
