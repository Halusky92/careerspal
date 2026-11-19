import assert from "node:assert/strict";
import test from "node:test";
import { computeTitleCompanyKey, dedupeAgainst } from "./dedupe";

test("a missing company name does not make two different roles look like the same posting", () => {
  assert.equal(computeTitleCompanyKey({ title: "Deal Desk Specialist", company_name: null }), "");
  const first = { id: "a", title: "Deal Desk Specialist", company_name: null, apply_url: "https://instacart.careers/job/?gh_jid=1", job_url: null };
  const second = { id: "b", title: "Deal Desk Specialist", company_name: null, apply_url: "https://instacart.careers/job/?gh_jid=2", job_url: null };
  const result = dedupeAgainst(first, [second], new Map());
  assert.equal(result.confidence, "none");
});

test("the same title at the same company still stays a possible duplicate", () => {
  const first = { id: "a", title: "Deal Desk Specialist", company_name: "Instacart", apply_url: "https://example.com/a", job_url: null };
  const second = { id: "b", title: "Deal Desk Specialist", company_name: "Instacart", apply_url: "https://example.com/b", job_url: null };
  const result = dedupeAgainst(first, [second], new Map());
  assert.equal(result.confidence, "possible");
});
