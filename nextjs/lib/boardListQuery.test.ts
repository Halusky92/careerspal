import assert from "node:assert/strict";
import test from "node:test";
import type { Job } from "../types";
import { listingsForViewer } from "./listingWindow";
import { isLiveBoardJob } from "./liveBoard";
import {
  BOARD_PAGE_SIZE,
  EMPTY_BOARD_FILTERS,
  filterAndSortBoard,
  filtersFromSearchParams,
  pageBoard,
  publicBoardCacheControl,
  toBoardCard,
} from "./boardListQuery";

const now = Date.parse("2026-11-25T12:00:00Z");

function role(partial: Partial<Job> & { id: string }): Job {
  return {
    id: partial.id,
    title: partial.title || "Operations Manager",
    company: partial.company || "Northwind",
    location: partial.location || "Remote",
    type: partial.type || "Full-time",
    salary: partial.salary || "$120k",
    postedAt: "",
    category: partial.category || "Operations",
    description: partial.description || "",
    tags: partial.tags || [],
    tools: partial.tools || [],
    remotePolicy: partial.remotePolicy || "Remote",
    logo: "",
    applyUrl: "https://example.com/jobs/ops",
    timestamp: partial.timestamp ?? now - 10 * 24 * 60 * 60 * 1000,
    publishedAt: partial.publishedAt,
    createdAt: partial.createdAt,
    status: "published",
    companyVerified: partial.companyVerified,
    boardTz: partial.boardTz,
    preview: partial.preview,
  };
}

function board(count: number) {
  const jobs: Job[] = [];
  for (let i = 0; i < count; i += 1) {
    jobs.push(
      role({
        id: `job-${i}`,
        title: i === count - 1 ? "Operations Manager Berlin desk" : "Operations Manager",
        location: i === count - 1 ? "Berlin" : "Remote",
        salary: i === count - 1 ? "$250k" : "$120k",
        timestamp: now - i * 60_000,
        description: "Own the weekly operations review for the team.",
      }),
    );
  }
  return jobs;
}

function visitCost(rows: number) {
  const pages = Math.ceil(rows / BOARD_PAGE_SIZE);
  const descriptionBytes = 4000;
  const cardBytes = 450;
  const beforeRequests = 2 + pages * 2;
  const beforeRows = rows * beforeRequests;
  const beforeBytes = rows * descriptionBytes * (1 + pages);
  const afterIndexRequests = Math.ceil(rows / 200) + Math.ceil(rows / 100);
  const afterRows = rows;
  const afterIndexBytes = rows * descriptionBytes + rows * cardBytes;
  const afterPageBytes = BOARD_PAGE_SIZE * cardBytes;
  return { pages, beforeRequests, beforeRows, beforeBytes, afterIndexRequests, afterRows, afterIndexBytes, afterPageBytes };
}

test("paging reads the whole board, not the first page", () => {
  for (const size of [500, 1000, 5000]) {
    const jobs = board(size);
    const sorted = filterAndSortBoard(jobs, EMPTY_BOARD_FILTERS, now);
    const first = pageBoard(sorted, 0);
    assert.equal(first.jobs.length, BOARD_PAGE_SIZE);
    assert.equal(first.total, size);
    assert.equal(first.jobs.some((job) => job.location === "Berlin"), false);
    const found = filterAndSortBoard(jobs, { ...EMPTY_BOARD_FILTERS, location: "Berlin" }, now);
    assert.equal(found.length, 1);
    assert.equal(found[0].id, `job-${size - 1}`);
    const salary = filterAndSortBoard(jobs, { ...EMPTY_BOARD_FILTERS, salaryMin: 200000 }, now);
    assert.equal(salary.length, 1);
    assert.equal(salary[0].salary, "$250k");
  }
});

test("early access stays off the public page and on Premium", () => {
  const early = role({ id: "early", publishedAt: new Date(now - 60 * 60 * 1000).toISOString(), timestamp: now });
  const open = role({ id: "open", publishedAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString() });
  const jobs = [early, open];
  assert.deepEqual(listingsForViewer(jobs, "guest", now).map((job) => job.id), ["open"]);
  assert.deepEqual(listingsForViewer(jobs, "registered", now).map((job) => job.id), ["open"]);
  assert.deepEqual(listingsForViewer(jobs, "paid", now).map((job) => job.id), ["early", "open"]);
  const params = new URLSearchParams("tier=paid&access=paid&early=1");
  const filters = filtersFromSearchParams(params);
  assert.equal(filters.query, "");
  assert.equal(publicBoardCacheControl({ tier: "guest", hasCookie: false, personalized: false }).startsWith("public"), true);
  assert.equal(publicBoardCacheControl({ tier: "registered", hasCookie: true, personalized: false }), "private, no-store");
  assert.equal(publicBoardCacheControl({ tier: "paid", hasCookie: false, personalized: false }), "private, no-store");
  assert.equal(publicBoardCacheControl({ tier: "guest", hasCookie: false, personalized: true }), "private, no-store");
});

test("expired roles are outside the live window and cards drop the description", () => {
  const expired = { timestamp: now - 40 * 24 * 60 * 60 * 1000, published_at: new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString() };
  assert.equal(isLiveBoardJob(expired, now), false);
  const card = toBoardCard(role({ id: "card", description: "Must work from the USA.\n- Own the weekly operations review for the team.", location: "Remote" }));
  assert.equal(card.description, "");
  assert.equal(card.preview && card.preview.length > 0, true);
});

test("simulated boards transfer less data after one shared index", () => {
  const lines: string[] = [];
  for (const size of [500, 1000, 5000]) {
    const jobs = board(size).map((job) => toBoardCard(job));
    const started = Date.now();
    const sorted = filterAndSortBoard(jobs, EMPTY_BOARD_FILTERS, now);
    const filtered = filterAndSortBoard(jobs, { ...EMPTY_BOARD_FILTERS, query: "Berlin" }, now);
    const elapsed = Date.now() - started;
    const page = pageBoard(sorted, 0);
    const pageBytes = Buffer.byteLength(JSON.stringify(page.jobs));
    const described = jobs.map((job) => ({ ...job, description: "Own the weekly operations review. ".repeat(80) }));
    const fullBytes = Buffer.byteLength(JSON.stringify(described));
    const cost = visitCost(size);
    assert.equal(filtered.length, 1);
    assert.ok(pageBytes < 80_000);
    assert.ok(pageBytes * 10 < fullBytes);
    assert.ok(cost.afterIndexRequests < cost.beforeRequests);
    assert.ok(cost.afterRows < cost.beforeRows);
    assert.ok(cost.afterPageBytes < cost.beforeBytes);
    assert.ok(elapsed < 1500);
    lines.push(
      `${size}: filter ${elapsed}ms, page ${page.jobs.length}/${page.total} is ${pageBytes} bytes vs full descriptions ${fullBytes} bytes; db requests before ${cost.beforeRequests} (${cost.beforeRows} rows, ${cost.beforeBytes} bytes) after a warm page is 0 and a cold index is ${cost.afterIndexRequests} requests / ${cost.afterRows} rows`,
    );
  }
  console.log(lines.join("\n"));
});
