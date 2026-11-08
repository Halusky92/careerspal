import assert from "node:assert/strict";
import test from "node:test";
import { publicCategoryLabel, resolveCategoryHub } from "./categories";

test("Strategy & Operations is Operations even if the DB says Systems Design", () => {
  const job = { title: "Startup Products Strategy & Operations, Insights", category: "Systems Design" };
  assert.equal(resolveCategoryHub(job)?.slug, "operations");
  assert.equal(publicCategoryLabel(job), "Operations");
});

test("Sales Operations is RevOps", () => {
  assert.equal(publicCategoryLabel({ title: "Sales Operations Manager", category: "Unknown" }), "RevOps");
});

test("Product Operations is Product Ops", () => {
  assert.equal(publicCategoryLabel({ title: "Sr. Product Operations", category: "Systems Design" }), "Product Ops");
});
