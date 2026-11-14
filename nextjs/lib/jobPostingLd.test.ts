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

test("International and Worldwide do not invent an applicant country", () => {
  const international = buildJobPostingLd(
    job({ location: "Remote", remotePolicy: "Remote", description: "This role is open to international candidates." }),
    "https://www.careerspal.com/jobs/international",
  );
  const worldwide = buildJobPostingLd(
    job({ location: "Worldwide", remotePolicy: "Remote", description: "Work from anywhere." }),
    "https://www.careerspal.com/jobs/worldwide",
  );
  assert.equal(international?.applicantLocationRequirements, undefined);
  assert.equal(worldwide?.applicantLocationRequirements, undefined);
  const unitedStates = buildJobPostingLd(job({ location: "Remote - US" }), "https://www.careerspal.com/jobs/us");
  assert.equal((unitedStates?.applicantLocationRequirements as { name: string }).name, "US");
});

test("does not emit JobPosting for expired or unpublished jobs", () => {
  assert.equal(shouldEmitJobPosting(job({ status: "draft" })), false);
  assert.equal(shouldEmitJobPosting(job({ timestamp: Date.now() - 40 * 24 * 60 * 60 * 1000 })), false);
  assert.equal(shouldEmitJobPosting(job({ applyUrl: "#" })), false);
  assert.equal(buildJobPostingLd(job({ applyUrl: "#" }), "https://www.careerspal.com/jobs/x"), null);
});
