import assert from "node:assert/strict";
import test from "node:test";
import {
  PUBLIC_CATEGORY_JOB_LIMIT,
  PUBLIC_COMPANY_JOB_LIMIT,
  buildPublicList,
  jobsForViewer,
  listCacheHeaders,
  previewListedJobs,
  publicSuggestItem,
  publicSuggestionLabels,
  toPublicJobCard,
  withoutHiddenStatuses,
} from "./publicListPreview";

const now = Date.parse("2026-11-13T12:00:00Z");

function job(id: string, timestamp: number, status = "published", company = "Stripe") {
  return {
    id,
    title: `Operations Manager ${id}`,
    company,
    location: "Remote",
    salary: "USD 120000-150000 year",
    description: `Secret description for ${id}. Apply at https://secret.example/${id}`,
    postedAt: "1d ago",
    timestamp,
    status,
    applyUrl: `https://jobs.example/${id}/apply`,
    category: "Operations",
  };
}

test("company and category previews stay inside that list", () => {
  const stripe = Array.from({ length: 13 }, (_, index) => job(`s${index}`, now - index * 1000));
  const other = job("other", now + 5000, "published", "Other Co");
  const company = buildPublicList([...stripe, other].filter((item) => item.company === "Stripe"), "guest", PUBLIC_COMPANY_JOB_LIMIT);
  assert.equal(company.total, 13);
  assert.equal(company.jobs.length, 3);
  assert.deepEqual(
    company.jobs.map((item) => item.id),
    ["s0", "s1", "s2"],
  );
  assert.equal(company.jobs.some((item) => item.company === "Other Co"), false);

  const category = buildPublicList(stripe, "registered", PUBLIC_CATEGORY_JOB_LIMIT);
  assert.equal(category.total, 13);
  assert.equal(category.jobs.length, 4);
  assert.equal(jobsForViewer(stripe, "guest", PUBLIC_CATEGORY_JOB_LIMIT).length, 4);
  assert.equal(jobsForViewer(stripe, "registered", PUBLIC_COMPANY_JOB_LIMIT).length, 3);
});

test("guest and free account share the public cap; premium receives every listed role", () => {
  const jobs = Array.from({ length: 6 }, (_, index) => job(`j${index}`, now - index));
  const guest = buildPublicList(jobs, "guest", PUBLIC_COMPANY_JOB_LIMIT);
  const free = buildPublicList(jobs, "registered", PUBLIC_COMPANY_JOB_LIMIT);
  const paid = buildPublicList(jobs, "paid", PUBLIC_COMPANY_JOB_LIMIT);
  assert.deepEqual(
    guest.jobs.map((item) => item.id),
    free.jobs.map((item) => item.id),
  );
  assert.deepEqual(
    paid.jobs.map((item) => item.id),
    ["j0", "j1", "j2", "j3", "j4", "j5"],
  );
  assert.equal(previewListedJobs(jobs, 2).length, 2);
});

test("public cards and suggest responses omit descriptions and apply URLs", () => {
  const source = job("s0", now);
  const card = toPublicJobCard(source);
  const encoded = JSON.stringify(card);
  assert.equal("description" in card, false);
  assert.equal("applyUrl" in card, false);
  assert.equal(encoded.includes("Secret description"), false);
  assert.equal(encoded.includes("jobs.example"), false);
  assert.equal(card.href.includes(source.id), true);

  const hidden = withoutHiddenStatuses([
    source,
    job("d", now, "draft"),
    job("p", now, "paused"),
    job("r", now, "rejected"),
    job("w", now, "pending_review"),
  ]);
  assert.deepEqual(
    hidden.map((item) => item.id),
    ["s0"],
  );

  const suggestion = publicSuggestItem({
    id: "role",
    label: "Operations Manager",
    hint: "Role",
    applyUrl: "https://secret.example",
    description: "full text",
  } as { id: string; label: string; hint: string });
  assert.deepEqual(Object.keys(suggestion || {}).sort(), ["hint", "id", "label"]);
  assert.deepEqual(publicSuggestionLabels(["Ops", { applyUrl: "https://secret.example" }, "Ops", ""], 8), ["Ops"]);
});

test("tiered list responses are not shared-cacheable", () => {
  const headers = listCacheHeaders();
  assert.match(headers["Cache-Control"], /private/);
  assert.match(headers["Cache-Control"], /no-store/);
  assert.match(headers["CDN-Cache-Control"], /no-store/);
  assert.match(headers.Vary, /Authorization/);
  assert.match(headers.Vary, /Cookie/);
});
