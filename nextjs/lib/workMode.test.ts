import assert from "node:assert/strict";
import test from "node:test";
import { geographyLabel, inferWorkMode, publicLocationLabel } from "./workMode";

test("office anchor days are Hybrid even if the ATS says Remote", () => {
  assert.equal(
    inferWorkMode({
      remotePolicy: "Remote",
      location: "San Francisco",
      description:
        "This role is based in our San Francisco office. We work from our offices on Mondays, Tuesdays and Thursdays (our Anchor Days).",
    }),
    "Hybrid",
  );
});

test("a city with no remote language is Onsite", () => {
  assert.equal(inferWorkMode({ location: "Nashville, Tennessee" }), "Onsite");
});

test("missing location is not invented as Remote", () => {
  assert.equal(inferWorkMode({}), "");
});

test("explicit remote policy without office days stays Remote", () => {
  assert.equal(inferWorkMode({ remotePolicy: "Remote (Global)", location: "Remote" }), "Remote");
});

test("an in-person title stays Onsite when the company describes itself as remote-first", () => {
  assert.equal(
    inferWorkMode({
      title: "Strategy & Operations Manager, In-person",
      remotePolicy: "Remote",
      description: "At Rula, we are a remote-first company. This role scales in-person psychiatry services.",
    }),
    "Onsite",
  );
});

test("a required hybrid office schedule is Hybrid", () => {
  assert.equal(
    inferWorkMode({
      remotePolicy: "Remote",
      location: "United States - Remote; United States - San Francisco, California",
      description: "This individual will work a hybrid schedule in-office (2 days a week), if within the Bay Area.",
    }),
    "Hybrid",
  );
});

test("company hybrid-hub boilerplate does not override a Remote - US location", () => {
  assert.equal(
    inferWorkMode({
      remotePolicy: "Remote",
      location: "Remote - US",
      description: "We have a hybrid-hub model. Whether you are in one of our offices or fully remote, we will support you.",
    }),
    "Remote",
  );
});

test("optional local hybrid stays Remote", () => {
  assert.equal(
    inferWorkMode({
      remotePolicy: "Remote",
      description: "Location: Remote, or hybrid in Cambridge, MA if you're local.",
    }),
    "Remote",
  );
});

test("a required office minimum of two days per week is Hybrid", () => {
  assert.equal(
    inferWorkMode({
      remotePolicy: "Remote",
      location: "United States (Remote)",
      description:
        "Employees are expected to be available to work from one of our office hubs at least two days per week, or eight days per month.",
    }),
    "Hybrid",
  );
});

test("three days each week in the office is Hybrid even when the ATS says Remote", () => {
  assert.equal(
    inferWorkMode({
      remotePolicy: "Remote",
      location: "Remote - US",
      description: "This role is remote, but you must be in the office three days a week.",
    }),
    "Hybrid",
  );
});

test("a fully remote sentence can fill work mode when location is blank", () => {
  assert.equal(
    inferWorkMode({
      description: "This is a fully remote role. You can work from home anywhere in the US.",
    }),
    "Remote",
  );
});

test("unspecified remote geography is Not specified and a named country is kept", () => {
  assert.equal(geographyLabel({ location: "Remote", remotePolicy: "Remote" }), "Not specified");
  assert.equal(geographyLabel({ location: "Remote", remotePolicy: "Remote", description: "We are a global company." }), "Not specified");
  assert.equal(geographyLabel({ location: "Remote (Global)", remotePolicy: "Remote" }), "Global");
  assert.equal(geographyLabel({ location: "Remote", description: "This role is open to international candidates." }), "International");
  assert.equal(geographyLabel({ location: "Remote - US", description: "We also hire international contractors." }), "US");
  assert.equal(geographyLabel({ location: "Worldwide", remotePolicy: "Remote" }), "Worldwide");
  assert.equal(geographyLabel({ location: "Remote - United Kingdom", remotePolicy: "Remote" }), "United Kingdom");
  assert.equal(geographyLabel({ location: "Remote - USA or Canada", remotePolicy: "Remote" }), "USA or Canada");
  assert.equal(geographyLabel({ location: "Remote - US", remotePolicy: "Remote" }), "US");
  assert.equal(geographyLabel({ location: "Hybrid - San Francisco - 3 days/week", remotePolicy: "Hybrid" }), "San Francisco 3 days/week");
  assert.equal(geographyLabel({ location: "New York, NY", remotePolicy: "Hybrid" }), "New York, NY");
  assert.equal(publicLocationLabel({ location: "Remote", description: "This role is open to international candidates." }), "Remote • International");
  assert.equal(publicLocationLabel({ location: "Worldwide", remotePolicy: "Remote" }), "Worldwide");
  assert.equal(publicLocationLabel({ location: "Remote", remotePolicy: "Remote" }), "Remote");
  assert.equal(publicLocationLabel({ location: "Remote - US", remotePolicy: "Remote" }), "Remote - US");
});
