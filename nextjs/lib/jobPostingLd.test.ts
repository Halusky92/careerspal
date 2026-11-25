import assert from "node:assert/strict";
import test from "node:test";
import { buildJobPostingLd, countryFromLocation, googleEmploymentType, shouldEmitJobPosting } from "./jobPostingLd";
import type { Job } from "../types";

const liveTs = Date.now();

function job(partial: Partial<Job>): Job {
  return {
    id: "job-1",
    title: "Revenue Operations Manager",
    company: "Acme",
    logo: "",
    location: "Remote - US",
    type: "Full-time",
    salary: "$120k–$150k a year",
    postedAt: "2026-11-01",
    category: "Operations",
    description: "Own RevOps systems and reporting.",
    tags: [],
    remotePolicy: "Remote",
    applyUrl: "https://boards.greenhouse.io/acme/jobs/1",
    timestamp: liveTs,
    status: "published",
    ...partial,
  };
}

test("maps employment types for Google Jobs", () => {
  assert.equal(googleEmploymentType("Full-time"), "FULL_TIME");
  assert.equal(googleEmploymentType("Contract"), "CONTRACTOR");
  assert.equal(googleEmploymentType("Unknown"), "OTHER");
});

test("reads US/Canada from location text without inventing a country", () => {
  assert.equal(countryFromLocation("Remote - US"), "US");
  assert.equal(countryFromLocation("Remote (US)"), "US");
  assert.equal(countryFromLocation("US Remote"), "US");
  assert.equal(countryFromLocation("Remote in the US"), "US");
  assert.equal(countryFromLocation("Remote, Canada"), "CA");
  assert.equal(countryFromLocation("Remote"), undefined);
});

test("emits JobPosting with salary, remote and apply URL without invented expiry", () => {
  const ld = buildJobPostingLd(job({}), "https://www.careerspal.com/jobs/revenue-operations-manager-job-1");
  assert.ok(ld);
  assert.equal(ld["@type"], "JobPosting");
  assert.equal(ld.employmentType, "FULL_TIME");
  assert.equal(ld.jobLocationType, "TELECOMMUTE");
  assert.equal((ld.baseSalary as { currency: string }).currency, "USD");
  assert.equal(ld.validThrough, undefined);
  assert.ok(typeof ld.datePosted === "string");
  assert.equal(ld.url, "https://www.careerspal.com/jobs/revenue-operations-manager-job-1");
  assert.equal(ld.directApply, undefined);
  assert.equal((ld.identifier as { name: string }).name, "Acme");
});

test("job posting description keeps paragraph breaks", () => {
  const ld = buildJobPostingLd(
    job({ description: "<p>Own the forecast.</p><ul><li>Report the weekly variance</li></ul>" }),
    "https://www.careerspal.com/jobs/desc",
  );
  const description = String(ld?.description || "");
  assert.match(description, /Own the forecast\./);
  assert.match(description, /\n- Report the weekly variance/);
  assert.equal(description.includes("<p>"), false);
});

test("a country name is not sent as a city", () => {
  const ld = buildJobPostingLd(
    job({ location: "Canada", remotePolicy: "Remote" }),
    "https://www.careerspal.com/jobs/canada-remote",
  );
  assert.equal(ld?.jobLocation, undefined);
  assert.equal(ld?.jobLocationType, "TELECOMMUTE");
  assert.equal((ld?.applicantLocationRequirements as { name: string }).name, "Canada");
});

test("JobPosting salary keeps both bounds and skips an OTE ceiling", () => {
  const ld = buildJobPostingLd(
    job({ salary: "$95k–$135k a year", description: "Senior Sales Operations Manager." }),
    "https://www.careerspal.com/jobs/outreach",
  );
  const value = (ld?.baseSalary as { value: { minValue: number; maxValue: number; unitText: string }; currency: string });
  assert.equal(value.currency, "USD");
  assert.equal(value.value.minValue, 95000);
  assert.equal(value.value.maxValue, 135000);
  assert.equal(value.value.unitText, "YEAR");
  const ote = buildJobPostingLd(
    job({ salary: "From $255k a year", description: "The annual OTE is up to $255,000." }),
    "https://www.careerspal.com/jobs/pandadoc",
  );
  assert.equal(ote?.baseSalary, undefined);
});

test("a base-pay range split by /year keeps both bounds in JobPosting", () => {
  const ld = buildJobPostingLd(
    job({
      salary: "From $180k a year",
      location: "Remote",
      remotePolicy: "Remote",
      description:
        "This role is remote within the United States. The typical base pay range for this role across the U.S. is: $180,000/year -$270,000/year + bonus + equity + benefits. There is a different range applicable to specific work locations.",
    }),
    "https://www.careerspal.com/jobs/vetcove-pay",
  );
  const value = ld?.baseSalary as { currency: string; value: { minValue: number; maxValue?: number; unitText: string } };
  assert.equal(value.currency, "USD");
  assert.equal(value.value.minValue, 180000);
  assert.equal(value.value.maxValue, 270000);
  assert.equal(value.value.unitText, "YEAR");
  assert.equal(ld?.validThrough, undefined);
});

test("a confirmed remote restriction in the posting becomes the applicant country", () => {
  const vetcove = buildJobPostingLd(
    job({
      location: "Remote",
      remotePolicy: "Remote",
      description: "BENEFITS: 100% remote within the United States, with travel for company retreats.",
    }),
    "https://www.careerspal.com/jobs/vetcove",
  );
  assert.equal((vetcove?.applicantLocationRequirements as { name: string }).name, "USA");
  const nova = buildJobPostingLd(
    job({
      location: "Remote",
      remotePolicy: "Remote",
      description: "Work Location and Hours. Work from home. Must work from the USA and be authorized to work for any U.S. employer.",
    }),
    "https://www.careerspal.com/jobs/nova",
  );
  assert.equal((nova?.applicantLocationRequirements as { name: string }).name, "USA");
  assert.equal(nova?.jobLocationType, "TELECOMMUTE");
  assert.equal(vetcove?.validThrough, undefined);
  assert.equal(vetcove?.jobLocation, undefined);

  const customers = buildJobPostingLd(
    job({
      location: "Remote",
      description: "Clinics in all 50 states rely on the product. Customers in the United States use it daily.",
    }),
    "https://www.careerspal.com/jobs/customers",
  );
  assert.equal(customers, null);
  const america = buildJobPostingLd(
    job({
      location: "Remote",
      remotePolicy: "Remote",
      description:
        "Owning a home is a foundational part of building financial security and wealth in America. The tools that support homeownership are antiquated.",
    }),
    "https://www.careerspal.com/jobs/vesta",
  );
  assert.equal(america, null);

  const both = buildJobPostingLd(
    job({ location: "Remote - USA or Canada", remotePolicy: "Remote" }),
    "https://www.careerspal.com/jobs/both",
  );
  assert.deepEqual(
    (both?.applicantLocationRequirements as Array<{ name: string }>).map((item) => item.name),
    ["USA", "Canada"],
  );
});

test("International and Worldwide do not invent an applicant country", () => {
  const international = buildJobPostingLd(
    job({ location: "Remote", remotePolicy: "Remote", description: "This role is open to international candidates." }),
    "https://www.careerspal.com/jobs/international",
  );
  const worldwide = buildJobPostingLd(
    job({ location: "Worldwide", remotePolicy: "Remote", description: "Work from anywhere." }),
    "https://www.careerspal.com/jobs/worldwide",
  );
  assert.equal(international, null);
  assert.equal(worldwide, null);
  const unitedStates = buildJobPostingLd(job({ location: "Remote - US" }), "https://www.careerspal.com/jobs/us");
  assert.equal((unitedStates?.applicantLocationRequirements as { name: string }).name, "USA");
});

test("a second currency in the posting is not sent to Google as USD", () => {
  const ld = buildJobPostingLd(
    job({
      location: "Canada",
      remotePolicy: "",
      salary: "$109k–$155k a year",
      description: "United States: $108.5K – $155K base Canada : CA$150.5K - CA$215K base",
    }),
    "https://www.careerspal.com/jobs/docker",
  );
  const canada = ld?.baseSalary as { currency: string; value: { minValue: number; maxValue: number } };
  assert.equal(canada.currency, "CAD");
  assert.equal(canada.value.minValue, 151000);
  assert.equal(canada.value.maxValue, 215000);
  const canadaAddress = (ld?.jobLocation as { address: { addressCountry?: string; addressLocality?: string } }).address;
  assert.equal(canadaAddress.addressCountry, "CA");
  assert.equal(canadaAddress.addressLocality, undefined);
  const confirmed = buildJobPostingLd(
    job({
      salary: "From $139k a year",
      description: "United States Salary Range $139,200 - $235,200 USD",
    }),
    "https://www.careerspal.com/jobs/gitlab",
  );
  const value = confirmed?.baseSalary as { currency: string; value: { minValue: number; maxValue: number } };
  assert.equal(value.currency, "USD");
  assert.equal(value.value.minValue, 139000);
  assert.equal(value.value.maxValue, 235000);
});

test("a hybrid role names the cities the posting confirms", () => {
  const ld = buildJobPostingLd(
    job({
      location: "Hybrid",
      remotePolicy: "Hybrid",
      description:
        "This role can be based in either San Francisco or New York City. We work from our offices on Mondays, Tuesdays and Thursdays.",
    }),
    "https://www.careerspal.com/jobs/notion",
  );
  const places = ld?.jobLocation as Array<{ address: { addressLocality: string } }>;
  assert.deepEqual(
    places.map((place) => place.address.addressLocality),
    ["San Francisco", "New York City"],
  );
});

test("a London dollar range is not labeled USD when the posting never names the currency", () => {
  const london = buildJobPostingLd(
    job({
      location: "London, England",
      remotePolicy: "Remote",
      salary: "$224k–$280k a year",
      description: "Lead EMEA sales operations from London. The range is listed as $224,000-$280,000.",
    }),
    "https://www.careerspal.com/jobs/temporal",
  );
  assert.equal(london?.baseSalary, undefined);
  assert.equal((london?.applicantLocationRequirements as { name: string }).name, "United Kingdom");
  const unitedStates = buildJobPostingLd(
    job({ salary: "$120k–$150k a year", description: "Own the operating cadence." }),
    "https://www.careerspal.com/jobs/us-dollars",
  );
  assert.equal((unitedStates?.baseSalary as { currency: string }).currency, "USD");
});

test("a stored floor plus a dollar range in the posting still needs a confirmed currency", () => {
  const london = buildJobPostingLd(
    job({
      location: "London, England",
      remotePolicy: "Remote",
      salary: "From $224k a year",
      description: "Lead EMEA sales operations. The range is $224,000-$280,000 a year.",
    }),
    "https://www.careerspal.com/jobs/temporal-floor",
  );
  assert.equal(london?.baseSalary, undefined);
  const unitedStates = buildJobPostingLd(
    job({
      salary: "From $180k a year",
      description: "The typical base pay range is $180,000/year -$270,000/year.",
    }),
    "https://www.careerspal.com/jobs/us-floor",
  );
  const value = (unitedStates?.baseSalary as { currency: string; value: { minValue: number; maxValue: number } }).value;
  assert.equal(value.minValue, 180000);
  assert.equal(value.maxValue, 270000);
});

test("does not emit JobPosting for expired or unpublished jobs", () => {
  assert.equal(shouldEmitJobPosting(job({ status: "draft" })), false);
  assert.equal(shouldEmitJobPosting(job({ timestamp: Date.now() - 40 * 24 * 60 * 60 * 1000 })), false);
  assert.equal(shouldEmitJobPosting(job({ applyUrl: "#" })), false);
  assert.equal(buildJobPostingLd(job({ applyUrl: "#" }), "https://www.careerspal.com/jobs/x"), null);
  assert.equal(
    shouldEmitJobPosting(job({ timestamp: undefined, publishedAt: new Date().toISOString() })),
    false,
  );
});
