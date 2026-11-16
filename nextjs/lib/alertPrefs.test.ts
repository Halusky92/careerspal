import assert from "node:assert/strict";
import test from "node:test";
import { jobMatchesSavedSearch, parseSavedSearch, savedSearchLabel, serializeSavedSearch } from "./alertPrefs";

const role = {
  title: "Revenue Operations Manager",
  category: "RevOps",
  location: "Remote • United States",
  remote_policy: "Remote",
  salary: "USD 140000-160000 year",
  tools: ["Salesforce"],
  tags: ["HubSpot"],
  keywords: "Notion",
  description: "Daily work in Excel and Slack.",
};

test("a legacy category string still matches that category", () => {
  const search = parseSavedSearch("revops");
  assert.equal(search.minSalary, null);
  assert.deepEqual(search.tools, []);
  assert.equal(jobMatchesSavedSearch(role, search), true);
});

test("salary floor drops a role whose stored pay is below it", () => {
  const search = parseSavedSearch(serializeSavedSearch({ categories: "revops", minSalary: 180000, region: "anywhere", tools: [] }));
  assert.equal(jobMatchesSavedSearch(role, search), false);
  assert.equal(
    jobMatchesSavedSearch(role, { ...search, minSalary: 120000 }),
    true,
  );
});

test("tools match stored tools and tags, not a mention in the description", () => {
  const withSalesforce = parseSavedSearch(
    serializeSavedSearch({ categories: "revops", minSalary: null, region: "anywhere", tools: ["Salesforce"] }),
  );
  assert.equal(jobMatchesSavedSearch(role, withSalesforce), true);
  const excelOnly = { ...withSalesforce, tools: ["Excel"] };
  assert.equal(jobMatchesSavedSearch(role, excelOnly), false);
  const both = { ...withSalesforce, tools: ["Salesforce", "HubSpot"] };
  assert.equal(jobMatchesSavedSearch(role, both), true);
  assert.match(savedSearchLabel(serializeSavedSearch(both)), /Salesforce/);
});
