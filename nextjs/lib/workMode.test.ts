import assert from "node:assert/strict";
import test from "node:test";
import { inferWorkMode } from "./workMode";

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
