import assert from "node:assert/strict";
import test from "node:test";
import { inferWorkMode } from "../../workMode";
import { discoveryMarketBlockers, discoverySourceKey } from "./discoveryPublishGate";

const usRemote = "This role is remote for anyone in the United States. ".repeat(8);

test("an empty location still qualifies when the description confirms US remote", () => {
  assert.deepEqual(
    discoveryMarketBlockers({
      title: "Revenue Operations Manager",
      location_text: "",
      remote_policy: "Remote",
      description_clean: usRemote,
    }),
    [],
  );
});

test("explicit Remote can publish with no country", () => {
  assert.deepEqual(
    discoveryMarketBlockers({
      title: "Revenue Operations Manager",
      location_text: "Remote",
      remote_policy: "Remote",
      description_clean: "This role is remote.",
    }),
    [],
  );
});

test("Remote - USA or Canada can publish when the United States is explicit", () => {
  assert.deepEqual(
    discoveryMarketBlockers({
      title: "Revenue Operations Partner",
      location_text: "Remote - USA or Canada",
      remote_policy: "Remote",
      description_clean: "Compensation is listed on the official posting.",
    }),
    [],
  );
});

test("United States without a remote confirmation stays unpublished", () => {
  assert.deepEqual(
    discoveryMarketBlockers({
      title: "Senior Revenue Operations Manager",
      location_text: "United States",
      remote_policy: "",
      description_clean: "The team sits in the United States.",
    }),
    ["onsite_only"],
  );
});

test("a city or remote mix stays unpublished", () => {
  assert.deepEqual(
    discoveryMarketBlockers({
      title: "Revenue Operations Manager",
      location_text: "New York, NY or Remote",
      remote_policy: "",
    }),
    ["remote_unconfirmed"],
  );
});

test("an explicit US hybrid can publish and stays Hybrid in the public label", () => {
  const job = {
    title: "Revenue Operations Manager",
    location_text: "New York, NY",
    remote_policy: "Hybrid",
    description_clean: "This is a hybrid role based in New York.",
  };
  assert.deepEqual(discoveryMarketBlockers(job), []);
  assert.equal(
    inferWorkMode({
      title: job.title,
      remotePolicy: job.remote_policy,
      location: job.location_text,
      description: job.description_clean,
    }),
    "Hybrid",
  );
});

test("hybrid outside the US, or hybrid without a country, stays unpublished", () => {
  assert.ok(
    discoveryMarketBlockers({
      title: "Revenue Operations Manager",
      location_text: "London",
      remote_policy: "Hybrid",
    }).includes("outside_us"),
  );
  assert.deepEqual(
    discoveryMarketBlockers({
      title: "Revenue Operations Manager",
      location_text: "",
      remote_policy: "Hybrid",
      description_clean: "This is a hybrid role.",
    }),
    ["geo_unconfirmed"],
  );
});

test("onsite stays blocked and a named remote country can publish", () => {
  assert.deepEqual(
    discoveryMarketBlockers({ title: "Revenue Operations Manager", location_text: "New York, NY", remote_policy: "" }),
    ["onsite_only"],
  );
  assert.deepEqual(
    discoveryMarketBlockers({
      title: "Revenue Operations Manager",
      location_text: "Remote - United Kingdom",
      remote_policy: "Remote",
    }),
    [],
  );
});

test("Toast hybrid policy is not labeled Remote, and Twilio exclusions are not dropped", () => {
  const toast = discoveryMarketBlockers({
    title: "Manager, Marketing Operations - Ad Tech Lead",
    location_text: "Remote",
    remote_policy: "Remote",
    description_clean: "Our Approach to Hybrid Working. We embrace a hybrid work model and publish in-office expectations by region.",
  });
  assert.equal(toast.includes("work_mode_conflict") || toast.includes("geo_unconfirmed"), true);
  assert.ok(
    discoveryMarketBlockers({
      title: "Revenue Operations Manager",
      location_text: "Remote",
      remote_policy: "Remote",
      description_clean: "The company describes a hybrid work model for this role.",
    }).includes("work_mode_conflict"),
  );
  assert.ok(
    discoveryMarketBlockers({
      title: "Marketing Operations Manager",
      location_text: "Remote - US",
      remote_policy: "Remote",
      description_clean: "This role will be remote, but is not eligible to be hired in CA, CT, NJ, NY, PA, WA.",
    }).includes("geo_restriction"),
  );
});

test("only a provider and identifier mark a discovery source", () => {
  assert.equal(discoverySourceKey("Ashby", "Pomelo-Care"), "ashby:pomelo-care");
  assert.equal(discoverySourceKey("greenhouse", ""), "");
});
