import assert from "node:assert/strict";
import test from "node:test";
import { buildSourcingOverview } from "./sourcingOverview";

const now = new Date("2026-11-10T22:00:00.000Z");

test("overview counts saved discovery sources and leaves unknown history empty", () => {
  const view = buildSourcingOverview({
    now,
    boards: [
      { provider: "ashby", identifier: "pomelo-care" },
      { provider: "greenhouse", identifier: "ziprecruiter" },
    ],
    sources: [
      {
        sourceType: "ashby",
        identifier: "pomelo-care",
        enabled: true,
        validationState: "allowed",
        createdAt: "2026-11-10T20:00:00.000Z",
        companyId: null,
        companyCreatedAt: null,
        approvedAt: "2026-11-10T20:05:00.000Z",
        approvalNotes: "auto: Revenue Operations Manager",
      },
      {
        sourceType: "greenhouse",
        identifier: "ziprecruiter",
        enabled: false,
        validationState: "allowed_needs_review",
        createdAt: "2026-11-04T12:00:00.000Z",
        companyId: "c1",
        companyCreatedAt: "2026-11-04T12:00:00.000Z",
      },
      {
        sourceType: "greenhouse",
        identifier: "stripe",
        enabled: true,
        validationState: "allowed",
        createdAt: "2026-11-10T20:00:00.000Z",
        companyId: "c2",
        companyCreatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    runs: [
      { createdAt: "2026-11-10T07:15:00.000Z", trigger: "cron", failedStep: null, timedOut: false, published: 1, closed: 0 },
      { createdAt: "2026-11-01T07:15:00.000Z", trigger: "cron", failedStep: "ingest", timedOut: false, published: null, closed: null },
    ],
    publishedJobs: 26,
    tavilySearches: 1,
  });

  assert.equal(view.windows?.today.sources, 1);
  assert.equal(view.windows?.today.companies, 0);
  assert.equal(view.windows?.today.published, 1);
  assert.equal(view.windows?.days7.sources, 2);
  assert.equal(view.windows?.days7.companies, 1);
  assert.equal(view.windows?.days30.published, 1);
  assert.equal(view.windows?.days30.closed, 0);
  assert.equal(view.pendingReview, 1);
  assert.equal(view.autoApproved, 1);
  assert.equal(view.approvals[0]?.title, "Revenue Operations Manager");
  assert.equal(view.tavily.used, 1);
  assert.equal(view.tavily.cap, 250);
  assert.equal(view.runs[1]?.error, "ingest");
});
