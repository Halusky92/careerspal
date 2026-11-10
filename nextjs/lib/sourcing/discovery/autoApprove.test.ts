import assert from "node:assert/strict";
import test from "node:test";
import { autoApprovalForNewSource } from "./autoApprove";

const role = { title: "Revenue Operations Manager", applyUrl: "https://jobs.ashbyhq.com/acme/1", salary: "USD 145000–165000 year" };

test("a new qualifying board is approved from its qualifying role", () => {
  const result = autoApprovalForNewSource({
    alreadySaved: false,
    autoApproveEnabled: true,
    decision: "pending_approval",
    qualifyingJobs: [role],
  });
  assert.equal(result.approve, true);
  if (result.approve) assert.equal(result.title, role.title);
});

test("existing, stopped, unclear, and incomplete boards stay off", () => {
  const base = { alreadySaved: false, autoApproveEnabled: true, decision: "pending_approval", qualifyingJobs: [role] };
  assert.equal(autoApprovalForNewSource({ ...base, alreadySaved: true }).reason, "existing_source");
  assert.equal(autoApprovalForNewSource({ ...base, autoApproveEnabled: false }).reason, "auto_approve_off");
  assert.equal(autoApprovalForNewSource({ ...base, decision: "rejected" }).reason, "not_qualifying");
  assert.equal(autoApprovalForNewSource({ ...base, qualifyingJobs: [{ ...role, salary: "" }] }).reason, "incomplete_job");
  assert.equal(autoApprovalForNewSource({ ...base, qualifyingJobs: [{ ...role, applyUrl: "#" }] }).reason, "incomplete_job");
});
