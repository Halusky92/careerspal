import assert from "node:assert/strict";
import test from "node:test";
import { companyLocationGroup, companyRoleFacets, filterCompanyRoles } from "./companyRoleFilters";

const role = (title: string, location: string, remotePolicy = "Remote") => ({
  title,
  category: "",
  location,
  remotePolicy,
});

test("company locations fall into one group and empty groups stay hidden", () => {
  const jobs = [
    role("Operations Manager", "Remote • United States"),
    role("Revenue Operations Manager", "New York, United States", "Hybrid"),
    role("Business Systems Analyst", "London, United Kingdom"),
    role("Automation Specialist", "Remote"),
  ];
  assert.equal(companyLocationGroup(jobs[0]), "United States");
  assert.equal(companyLocationGroup(jobs[2]), "Europe");
  assert.equal(companyLocationGroup(jobs[3]), "Worldwide");
  const facets = companyRoleFacets(jobs, { q: "", place: "", category: "", work: "" });
  assert.equal(facets.total, 4);
  assert.equal(facets.locations.find((row) => row.label === "United States")?.count, 2);
  assert.equal(facets.locations.find((row) => row.label === "Europe")?.count, 1);
  assert.equal(facets.locations.find((row) => row.label === "Worldwide")?.count, 1);
  assert.equal(facets.locations.some((row) => row.label === "Other locations"), false);
  assert.equal(facets.categories.reduce((sum, row) => sum + row.count, 0), 4);
});

test("company counts follow the other filters and skip roles the company does not have", () => {
  const jobs = [
    role("Operations Manager", "Remote • United States"),
    role("Operations Analyst", "Remote • United States"),
    role("Chief of Staff", "Berlin, Germany", "Hybrid"),
  ];
  const narrowed = companyRoleFacets(jobs, { q: "", place: "United States", category: "", work: "" });
  assert.equal(narrowed.total, 2);
  assert.equal(narrowed.categories.find((row) => row.label === "Operations")?.count, 2);
  assert.equal(narrowed.categories.some((row) => row.label === "Chief of Staff"), false);
  assert.equal(narrowed.work.find((row) => row.label === "Remote")?.count, 2);
  assert.equal(narrowed.locations.find((row) => row.label === "Europe")?.count, 1);
  assert.equal(filterCompanyRoles(jobs, { q: "analyst", place: "", category: "", work: "" }).length, 1);
});
