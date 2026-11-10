import assert from "node:assert/strict";
import test from "node:test";
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

test("remote without a US location or description stays unpublished", () => {
  assert.deepEqual(
    discoveryMarketBlockers({
      title: "Revenue Operations Manager",
      location_text: "",
      remote_policy: "Remote",
      description_clean: "This role is remote.",
    }),
    ["geo_unconfirmed"],
  );
});

test("onsite, hybrid, and non-US roles are blocked", () => {
  assert.deepEqual(
    discoveryMarketBlockers({ title: "Revenue Operations Manager", location_text: "New York, NY", remote_policy: "" }),
    ["onsite_only"],
  );
  assert.ok(
    discoveryMarketBlockers({
      title: "Revenue Operations Manager",
      location_text: "Remote - United States",
      remote_policy: "Hybrid",
    }).includes("hybrid_not_remote"),
  );
  assert.ok(
    discoveryMarketBlockers({
      title: "Revenue Operations Manager",
      location_text: "London",
      remote_policy: "Remote",
    }).includes("outside_us"),
  );
});

test("only a provider and identifier mark a discovery source", () => {
  assert.equal(discoverySourceKey("Ashby", "Pomelo-Care"), "ashby:pomelo-care");
  assert.equal(discoverySourceKey("greenhouse", ""), "");
});
