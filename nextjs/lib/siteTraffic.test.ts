import assert from "node:assert/strict";
import test from "node:test";
import { buildDailySiteTraffic, visitorKey } from "./siteTraffic";

test("visitor key prefers the browser session over the IP hash", () => {
  assert.equal(visitorKey({ metadata: { sessionId: "sid-1", ipHash: "ip-1" } }), "sid-1");
  assert.equal(visitorKey({ metadata: { ipHash: "ip-1" } }), "ip-1");
});

test("daily traffic counts unique people and apply clicks without inventing days", () => {
  const now = new Date("2026-11-08T12:00:00.000Z");
  const days = buildDailySiteTraffic(
    [
      { created_at: "2026-11-08T01:00:00.000Z", metadata: { sessionId: "a" } },
      { created_at: "2026-11-08T02:00:00.000Z", metadata: { sessionId: "a" } },
      { created_at: "2026-11-08T03:00:00.000Z", metadata: { sessionId: "b" } },
      { created_at: "2026-11-07T12:00:00.000Z", metadata: { sessionId: "c" } },
    ],
    [
      { created_at: "2026-11-08T04:00:00.000Z" },
      { created_at: "2026-11-08T05:00:00.000Z" },
    ],
    3,
    now,
  );
  assert.equal(days.length, 3);
  assert.equal(days[0].date, "2026-11-06");
  assert.equal(days[0].visitors, 0);
  assert.equal(days[1].date, "2026-11-07");
  assert.equal(days[1].visitors, 1);
  assert.equal(days[2].date, "2026-11-08");
  assert.equal(days[2].visitors, 2);
  assert.equal(days[2].views, 3);
  assert.equal(days[2].applyClicks, 2);
});
