import assert from "node:assert/strict";
import test from "node:test";
import { DESCRIPTION_MAX, localListingIssues } from "./listingFieldChecks";

test("salary-first: numbers required, competitive is not enough", () => {
  const issues = localListingIssues({
    title: "Operations Manager",
    description: "Run workflows, process design, and internal operations across the team. ".repeat(8),
    salary: "competitive",
    applyUrl: "https://company.com/jobs",
    company: "Acme",
    remotePolicy: "Remote (Global)",
    category: "Operations",
  });
  assert.ok(issues.some((issue) => issue.field === "salary"));
});

test("step 1 does not nag about company before that field exists", () => {
  const issues = localListingIssues({
    title: "Automation Engineer",
    description: "Own workflow automation across ops teams. ".repeat(12),
    salary: "$90k-$120k",
    applyUrl: "",
    company: "",
    remotePolicy: "Remote (Global)",
    category: "Automation",
  });
  assert.ok(!issues.some((issue) => /company|apply link/i.test(issue.message) && issue.field === "description"));
  assert.ok(!issues.some((issue) => issue.message.startsWith("Add company, apply")));
});

test("any non-empty company name is accepted", () => {
  const issues = localListingIssues({
    title: "Business Systems Analyst",
    description: "Own internal tools and process work.",
    salary: "80 000",
    applyUrl: "mailto:jobs@firm.com",
    company: "districk 9",
    remotePolicy: "Remote (Global)",
    category: "Systems Design",
  });
  assert.ok(!issues.some((issue) => issue.field === "company"));
});

test("short employer copy is allowed; no 280-char or ops-wording nags", () => {
  const issues = localListingIssues({
    title: "Business Systems Analyst",
    description: "ahoj vsetko je ok mozes to postnit",
    salary: "80 000",
    applyUrl: "https://company.com/jobs",
    company: "Acme",
    remotePolicy: "Remote (Global)",
    category: "Systems Design",
  });
  assert.ok(!issues.some((issue) => issue.field === "description"));
});

test("description over the character cap is rejected", () => {
  const issues = localListingIssues({
    title: "Operations Manager",
    description: `${"Run workflows and internal operations. ".repeat(20)}${"x".repeat(DESCRIPTION_MAX)}`,
    salary: "$90k-$120k",
    applyUrl: "https://company.com/jobs",
    company: "Acme",
    remotePolicy: "Remote (Global)",
    category: "Operations",
  });
  assert.ok(issues.some((issue) => issue.field === "description" && /4000/.test(issue.message)));
});

test("apply link and niche title still gate the board", () => {
  const off = localListingIssues({
    title: "Sales Intern",
    description: "Sell widgets on the phone every day with a headset and a CRM login. ".repeat(6),
    salary: "$80k-$100k",
    applyUrl: "#",
    company: "Acme",
    category: "Operations",
  });
  assert.ok(off.some((issue) => issue.field === "title"));
  assert.ok(off.some((issue) => issue.field === "applyUrl"));
});
