import assert from "node:assert/strict";
import test from "node:test";
import { categoryAvailability, categoryCountsForJobs, publicCategoryLabel, resolveCategoryHub } from "./categories";

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

test("a guest count leaves the first 24 hours out, and Premium includes them", () => {
  const now = Date.parse("2026-11-19T12:00:00.000Z");
  const jobs = [
    { title: "Revenue Operations Manager", category: null, publishedAt: "2026-11-10T12:00:00.000Z" },
    { title: "Revenue Operations Analyst", category: null, publishedAt: "2026-11-19T06:00:00.000Z" },
    { title: "Chief of Staff", category: null, publishedAt: "2026-11-19T08:00:00.000Z" },
  ];
  const guest = categoryAvailability(jobs, "guest", now);
  assert.equal(guest.open.revops, 1);
  assert.equal(guest.early.revops, 1);
  assert.equal(guest.early["chief-of-staff"], 1);
  const paid = categoryAvailability(jobs, "paid", now);
  assert.equal(paid.open.revops, 2);
  assert.equal(paid.open["chief-of-staff"], 1);
  assert.equal(paid.early.revops, 0);
});
