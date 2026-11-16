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
  const search = parseSavedSearch(serializeSavedSearch({ categories: "revops", minSalary: 180000, region: "anywhere", workMode: "any", tools: [] }));
  assert.equal(jobMatchesSavedSearch(role, search), false);
  assert.equal(
    jobMatchesSavedSearch(role, { ...search, minSalary: 120000 }),
    true,
  );
});

test("tools match stored tools and tags, not a mention in the description", () => {
  const withSalesforce = parseSavedSearch(
    serializeSavedSearch({ categories: "revops", minSalary: null, region: "anywhere", workMode: "any", tools: ["Salesforce"] }),
  );
  assert.equal(jobMatchesSavedSearch(role, withSalesforce), true);
  const excelOnly = { ...withSalesforce, tools: ["Excel"] };
  assert.equal(jobMatchesSavedSearch(role, excelOnly), false);
  const both = { ...withSalesforce, tools: ["Salesforce", "HubSpot"] };
  assert.equal(jobMatchesSavedSearch(role, both), true);
  assert.match(savedSearchLabel(serializeSavedSearch(both)), /Salesforce/);
});

test("place and work mode combine, and an old remote region stays a work mode", () => {
  const legacy = parseSavedSearch(JSON.stringify({ categories: "revops", region: "remote" }));
  assert.equal(legacy.region, "anywhere");
  assert.equal(legacy.workMode, "remote");
  const usRemote = { ...legacy, region: "us" as const };
  const remoteUs = { title: "Revenue Operations Manager", location: "Remote • United States", remote_policy: "Remote" };
  const remoteEu = { title: "Revenue Operations Manager", location: "Remote • Germany", remote_policy: "Remote" };
  assert.equal(jobMatchesSavedSearch(remoteUs, usRemote), true);
  assert.equal(jobMatchesSavedSearch(remoteEu, usRemote), false);
});
