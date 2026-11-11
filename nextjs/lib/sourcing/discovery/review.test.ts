import assert from "node:assert/strict";
import test from "node:test";
import { officialBoardUrl } from "./atsLinks";
import { reviewDiscoveryBatch, toPendingSourceRow, type DiscoveryFetcher, type DiscoveryLead } from "./review";

const ROLE =
  "Revenue Operations Manager. This role owns business operations, revenue operations, and pipeline operations for the United States team. " +
  "Compensation: $140,000 to $170,000 per year. You will run the operating cadence, document the process, and improve handoffs across the revenue team. " +
  "The position is remote for candidates in the United States and reports into the operations leadership group.";

function fetcher(map: Record<string, { status?: number; body: string }>): DiscoveryFetcher {
  return async (url) => {
    const hit = map[url];
    if (!hit) return { status: 404, body: "" };
    return { status: hit.status ?? 200, body: hit.body };
  };
}

function greenhouseDetail(title: string, location: string, content = `<p>${ROLE}</p>`) {
  return JSON.stringify({
    id: 11,
    title,
    absolute_url: "https://boards.greenhouse.io/fixtureops/jobs/11",
    location: { name: location },
    content,
  });
}

test("a careers page with an official Greenhouse board becomes a pending source", async () => {
  const lead: DiscoveryLead = {
    companyName: "Fixture Ops",
    website: "https://fixture-ops.example",
    careersUrl: "https://fixture-ops.example/careers",
  };
  const reviews = await reviewDiscoveryBatch(
    [lead],
    fetcher({
      "https://fixture-ops.example/careers": {
        body: `<a href="https://job-boards.greenhouse.io/fixtureops/jobs/11">Open roles</a>`,
      },
      "https://boards-api.greenhouse.io/v1/boards/fixtureops/jobs": {
        body: JSON.stringify({
          jobs: [
            { id: 11, title: "Revenue Operations Manager" },
            { id: 12, title: "Software Engineer" },
          ],
        }),
      },
      "https://boards-api.greenhouse.io/v1/boards/fixtureops/jobs/11": {
        body: greenhouseDetail("Revenue Operations Manager", "Remote - United States"),
      },
    }),
    { limit: 5 },
  );
  assert.equal(reviews.length, 1);
  const review = reviews[0];
  assert.equal(review.decision, "pending_approval");
  assert.equal(review.enabled, false);
  assert.equal(review.atsProvider, "greenhouse");
  assert.equal(review.atsIdentifier, "fixtureops");
  assert.equal(review.boardUrl, "https://boards.greenhouse.io/fixtureops");
  assert.equal(review.openJobCount, 2);
  assert.equal(review.qualifyingJobCount, 1);
  assert.equal(review.qualifyingTitles[0], "Revenue Operations Manager");
  const row = toPendingSourceRow(review);
  assert.equal(row?.enabled, false);
  assert.equal(row?.approval_decision, null);
  assert.equal(row?.validation_state, "allowed_needs_review");
});

test("aggregators and duplicate boards are rejected without a qualifying row", async () => {
  const pages = fetcher({
    "https://fixture-ops.example/careers": {
      body: `<a href="https://boards.greenhouse.io/fixtureops">Careers</a>`,
    },
    "https://boards-api.greenhouse.io/v1/boards/fixtureops/jobs": {
      body: JSON.stringify({ jobs: [] }),
    },
  });
  const reviews = await reviewDiscoveryBatch(
    [
      { companyName: "Indeed Mirror", website: "https://www.indeed.com/jobs" },
      { companyName: "Link Only", website: "https://link-only.example", careersUrl: "https://link-only.example/careers" },
      { companyName: "Fixture Ops", website: "https://fixture-ops.example", careersUrl: "https://fixture-ops.example/careers" },
      { companyName: "Same Board", website: "https://same-board.example", atsUrl: "https://boards.greenhouse.io/fixtureops" },
    ],
    (url) => {
      if (url.includes("indeed.com")) throw new Error("should not fetch an aggregator");
      if (url.includes("link-only.example")) {
        return Promise.resolve({ status: 200, body: `<a href="https://www.indeed.com/viewjob?jk=1">Apply</a>` });
      }
      return pages(url);
    },
    { limit: 10 },
  );
  assert.deepEqual(
    reviews.map((review) => review.reason),
    ["aggregator", "no_official_ats", "no_open_jobs", "duplicate_source"],
  );
  assert.equal(toPendingSourceRow(reviews[2]), null);
});

test("a United Kingdom remote role and an unavailable board do not qualify", async () => {
  const reviews = await reviewDiscoveryBatch(
    [
      { companyName: "UK Fixture", website: "https://uk-fixture.example", atsUrl: "https://jobs.ashbyhq.com/ukfixture" },
      { companyName: "Down Fixture", website: "https://down-fixture.example", atsUrl: "https://jobs.lever.co/downfixture" },
    ],
    fetcher({
      "https://api.ashbyhq.com/posting-api/job-board/ukfixture?includeCompensation=true": {
        body: JSON.stringify({
          jobs: [
            {
              id: "uk-1",
              title: "Revenue Operations Manager",
              locationName: "Remote - United Kingdom",
              isRemote: true,
              applyUrl: "https://jobs.ashbyhq.com/ukfixture/uk-1",
              descriptionPlain: ROLE,
              compensation: {
                compensationTiers: [{ components: [{ compensationType: "Salary", minValue: 140000, maxValue: 170000, currencyCode: "USD", interval: "1 year" }] }],
              },
            },
          ],
        }),
      },
      "https://api.lever.co/v0/postings/downfixture?mode=json": { status: 404, body: "" },
    }),
  );
  assert.equal(reviews[0].decision, "rejected");
  assert.equal(reviews[0].qualifyingJobCount, 0);
  assert.equal(reviews[0].openJobCount, 1);
  assert.equal(reviews[0].reason, "no_qualifying_jobs");
  assert.equal(reviews[1].reason, "ats_unavailable");
  assert.equal(reviews[1].enabled, false);
});

test("an inconclusive Greenhouse sample is held and not enabled", async () => {
  const jobs = Array.from({ length: 13 }, (_, index) => ({ id: index + 1, title: "Business Operations Analyst" }));
  const map: Record<string, { body: string }> = {
    "https://boards-api.greenhouse.io/v1/boards/wideboard/jobs": { body: JSON.stringify({ jobs }) },
  };
  for (const job of jobs.slice(0, 12)) {
    map[`https://boards-api.greenhouse.io/v1/boards/wideboard/jobs/${job.id}`] = {
      body: JSON.stringify({
        id: job.id,
        title: job.title,
        absolute_url: `https://boards.greenhouse.io/wideboard/jobs/${job.id}`,
        location: { name: "Remote - United States" },
        content: "<p>Short operations note.</p>",
      }),
    };
  }
  const reviews = await reviewDiscoveryBatch(
    [{ companyName: "Wide Fixture", website: "https://wide-fixture.example", atsUrl: "https://boards.greenhouse.io/wideboard" }],
    fetcher(map),
  );
  assert.equal(reviews[0].decision, "held");
  assert.equal(reviews[0].reason, "sample_inconclusive");
  assert.equal(reviews[0].enabled, false);
  assert.equal(reviews[0].unsampledNicheJobs, 1);
  assert.equal(toPendingSourceRow(reviews[0]), null);
});

test("greenhouse content mode counts every open job in one list response", async () => {
  const seen: string[] = [];
  const reviews = await reviewDiscoveryBatch(
    [{ companyName: "Fixture Ops", website: "https://fixture-ops.example", atsUrl: "https://boards.greenhouse.io/fixtureops" }],
    async (url) => {
      seen.push(url);
      return {
        status: 200,
        body: JSON.stringify({
          jobs: [
            {
              id: 11,
              title: "Revenue Operations Manager",
              absolute_url: "https://boards.greenhouse.io/fixtureops/jobs/11",
              location: { name: "Remote - United States" },
              content: `<p>${ROLE}</p>`,
            },
            { id: 12, title: "Software Engineer", location: { name: "Remote - United States" }, content: "<p>Engineer</p>" },
          ],
        }),
      };
    },
    { greenhouseUseContent: true },
  );
  assert.deepEqual(seen, ["https://boards-api.greenhouse.io/v1/boards/fixtureops/jobs?content=true"]);
  assert.equal(reviews[0].qualifyingJobCount, 1);
  assert.equal(reviews[0].rejectionCounts.off_niche_title, 1);
  assert.equal(reviews[0].unsampledNicheJobs, 0);
});

test("different Greenhouse boards are not treated as the same company", async () => {
  const seen: string[] = [];
  const reviews = await reviewDiscoveryBatch(
    [
      { companyName: "alpha", website: "https://boards.greenhouse.io/alpha", atsUrl: "https://boards.greenhouse.io/alpha" },
      { companyName: "beta", website: "https://boards.greenhouse.io/beta", atsUrl: "https://boards.greenhouse.io/beta" },
    ],
    async (url) => {
      seen.push(url);
      return { status: 200, body: JSON.stringify({ jobs: [] }) };
    },
    { greenhouseUseContent: true },
  );
  assert.equal(reviews[0].reason, "no_open_jobs");
  assert.equal(reviews[1].reason, "no_open_jobs");
  assert.equal(seen.length, 2);
});

const LONG =
  "Revenue Operations Manager. Compensation is $140,000 to $170,000 per year. You will run the operating cadence, document the process, improve handoffs, and keep the weekly review useful for the revenue team. ".repeat(2);

test("in-person and unconfirmed remote stay out, while explicit US hybrid qualifies", async () => {
  const jobs = [
    {
      id: 1,
      title: "Strategy & Operations Manager, In-person",
      absolute_url: "https://boards.greenhouse.io/fixtureops/jobs/1",
      location: { name: "Remote" },
      content: `<p>${LONG} The company is remote-first and hires in the United States.</p>`,
    },
    {
      id: 2,
      title: "RevOps Strategic Initiatives Manager",
      absolute_url: "https://boards.greenhouse.io/fixtureops/jobs/2",
      location: { name: "United States - Remote" },
      content: `<p>${LONG} This individual will work a hybrid schedule in-office (2 days a week) in San Francisco.</p>`,
    },
    {
      id: 3,
      title: "Revenue Operations Manager",
      absolute_url: "https://boards.greenhouse.io/fixtureops/jobs/3",
      location: { name: "Remote" },
      content: `<p>${LONG} Join us. This is a fully remote role.</p>`,
    },
    {
      id: 4,
      title: "Research Operations Lead",
      absolute_url: "https://boards.greenhouse.io/fixtureops/jobs/4",
      location: { name: "San Francisco, CA, or Remote within Canada or United States" },
      content: `<p>${LONG} US employees may work remotely.</p>`,
    },
  ];
  const reviews = await reviewDiscoveryBatch(
    [{ companyName: "Fixture Ops", website: "https://fixture-ops.example", atsUrl: "https://boards.greenhouse.io/fixtureops" }],
    async () => ({ status: 200, body: JSON.stringify({ jobs }) }),
    { greenhouseUseContent: true },
  );
  assert.deepEqual(reviews[0].qualifyingTitles, [
    "RevOps Strategic Initiatives Manager",
    "Research Operations Lead",
  ]);
  assert.equal(reviews[0].rejectionCounts.onsite_only, 1);
  assert.equal(reviews[0].rejectionCounts.geo_unconfirmed, 1);
  assert.equal(reviews[0].rejectionCounts.hybrid_not_remote, undefined);
});

test("job-board Greenhouse hosts canonicalize to the official board", () => {
  assert.equal(
    officialBoardUrl("https://job-boards.greenhouse.io/FixtureOps/jobs/11?utm_source=x"),
    "https://boards.greenhouse.io/fixtureops",
  );
  assert.equal(officialBoardUrl("https://www.indeed.com/viewjob?jk=1"), null);
});
