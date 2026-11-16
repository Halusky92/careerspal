import assert from "node:assert/strict";
import test from "node:test";
import { jobMatchesLocationQuery, locationFilterOptions, workModeFromPlaceLabel } from "./locationFilter";

test("place options keep countries and cities, and leave remote to work mode", () => {
  const options = locationFilterOptions([
    { location: "Remote • United States", remotePolicy: "Remote" },
    { location: "San Francisco, CA", remotePolicy: "Hybrid" },
    { location: "Remote • United Kingdom", remotePolicy: "Remote" },
  ]);
  const labels = options.map((item) => item.label);
  assert.equal(labels.includes("Remote"), false);
  assert.equal(labels.includes("Hybrid"), false);
  assert.equal(labels.includes("United States"), true);
  assert.equal(labels.includes("San Francisco"), true);
  assert.equal(labels.includes("United Kingdom"), true);
  assert.equal(
    jobMatchesLocationQuery({ location: "Remote • United States", remotePolicy: "Remote" }, "United States"),
    true,
  );
  assert.equal(
    jobMatchesLocationQuery({ location: "Remote • Germany", remotePolicy: "Remote" }, "United States"),
    false,
  );
  assert.equal(jobMatchesLocationQuery({ location: "San Francisco, CA", remotePolicy: "Hybrid" }, "San Francisco"), true);
  assert.equal(
    jobMatchesLocationQuery(
      {
        location: "Remote",
        remotePolicy: "Remote",
        description: "Candidates must be based in the United States.",
      },
      "United States",
    ),
    true,
  );
  assert.equal(workModeFromPlaceLabel("Remote"), "Remote");
  assert.equal(workModeFromPlaceLabel("On-site"), "Onsite");
  assert.equal(workModeFromPlaceLabel("United States"), null);
});
