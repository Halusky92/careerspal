import assert from "node:assert/strict";
import test from "node:test";
import { categoryCountsForJobs, publicCategoryLabel, resolveCategoryHub } from "./categories";

test("Strategy & Operations is Operations even if the DB says Systems Design", () => {
  const job = { title: "Startup Products Strategy & Operations, Insights", category: "Systems Design" };
  assert.equal(resolveCategoryHub(job)?.slug, "operations");
  assert.equal(publicCategoryLabel(job), "Operations");
});

test("Sales Operations is RevOps", () => {
  assert.equal(publicCategoryLabel({ title: "Sales Operations Manager", category: "Unknown" }), "RevOps");
});

test("category counts follow the full visible board, not a short page", () => {
  const counts = categoryCountsForJobs([
    { title: "Revenue Operations Manager", category: null },
    { title: "Chief of Staff", category: null },
    { title: "Revenue Operations Analyst", category: null },
  ]);
  assert.equal(counts["All Roles"], 3);
  assert.equal(counts.revops, 2);
  assert.equal(counts["chief-of-staff"], 1);
});
