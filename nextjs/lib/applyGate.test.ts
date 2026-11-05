import assert from "node:assert/strict";
import test from "node:test";
import { applyLinkReady, authHrefForApply } from "./applyGate";

test("placeholder apply links are not ready", () => {
  assert.equal(applyLinkReady(""), false);
  assert.equal(applyLinkReady("#"), false);
  assert.equal(applyLinkReady("https://firm.com/jobs"), true);
  assert.equal(applyLinkReady("mailto:jobs@firm.com"), true);
});

test("apply auth return path stays on-site", () => {
  assert.equal(authHrefForApply("/jobs/ops-role"), "/auth?from=%2Fjobs%2Fops-role");
});

test("guest apply stays on CareersPal auth, then returns to the job", () => {
  assert.equal(authHrefForApply("/jobs/ops-role"), "/auth?from=%2Fjobs%2Fops-role");
  assert.equal(authHrefForApply("/jobs/ops-role").includes("/apply/continue"), false);
});
