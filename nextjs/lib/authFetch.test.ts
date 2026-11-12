import assert from "node:assert/strict";
import test from "node:test";
import { authHeaders } from "./authFetch";

test("the checkout availability request keeps the session token out of the URL", () => {
  const token = "signed-session-token";
  const url = "/api/stripe/checkout";
  const headers = authHeaders(token);
  assert.equal(url, "/api/stripe/checkout");
  assert.equal(url.includes(token), false);
  assert.equal(url.includes("?"), false);
  assert.equal(headers.get("Authorization"), `Bearer ${token}`);

  const anonymous = authHeaders(null);
  assert.equal(anonymous.get("Authorization"), null);
  assert.equal([...anonymous.keys()].length, 0);
});
