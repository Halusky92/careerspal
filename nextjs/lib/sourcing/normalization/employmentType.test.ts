import assert from "node:assert/strict";
import test from "node:test";
import { detectEmploymentType } from "./employmentType";

test("a deal-desk sentence about contracting is not a contract job", () => {
  assert.equal(
    detectEmploymentType({
      title: "Senior Manager, Global Deal Desk",
      description: "True-up provisions are documented in the quoting and contracting process. This is a full-time role.",
    }).type,
    "Full-time",
  );
});

test("an explicit contract role stays Contract", () => {
  assert.equal(detectEmploymentType({ title: "Contract Operations Manager" }).type, "Contract");
  assert.equal(
    detectEmploymentType({ description: "This is a 6-month contract." }).type,
    "Contract",
  );
});

test("an independent contractor and a contract position are Contract", () => {
  assert.equal(detectEmploymentType({ description: "You will work as an independent contractor." }).type, "Contract");
  assert.equal(detectEmploymentType({ title: "Operations Manager", headerText: "Contract" }).type, "Contract");
});

test("contract negotiations do not make a full-time role a contract", () => {
  assert.equal(
    detectEmploymentType({
      title: "Revenue Operations Partner",
      headerText: "Full-time",
      description: "Own contract negotiations with vendors. Employment type is full-time.",
    }).type,
    "Full-time",
  );
});

test("a bare contract word in the body does not beat full-time", () => {
  assert.equal(
    detectEmploymentType({
      title: "Payment Operations Analyst",
      description: "You will review the vendor contract. The role is full-time.",
    }).type,
    "Full-time",
  );
});
