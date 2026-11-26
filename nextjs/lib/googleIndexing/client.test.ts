import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import { publishIndexNotification, resetIndexingTokenCache } from "./client";
import { indexingCredentials, indexingLiveEnabled, indexingScope } from "./credentials";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}

test("credentials stay off unless the live switch is exactly 1", () => {
  assert.equal(indexingScope(), "https://www.googleapis.com/auth/indexing");
  assert.equal(indexingLiveEnabled({}), false);
  assert.equal(indexingLiveEnabled({ GOOGLE_INDEXING_LIVE: "0" }), false);
  assert.equal(indexingLiveEnabled({ GOOGLE_INDEXING_LIVE: "1" }), true);
  assert.equal(indexingCredentials({}), null);
  const parsed = indexingCredentials({
    GOOGLE_INDEXING_CLIENT_EMAIL: "indexing@example.iam.gserviceaccount.com",
    GOOGLE_INDEXING_PRIVATE_KEY: pem.replace(/\n/g, "\\n"),
  });
  assert.equal(parsed?.email, "indexing@example.iam.gserviceaccount.com");
  assert.equal(parsed?.privateKey.includes("PRIVATE KEY"), true);
  assert.equal(JSON.stringify(parsed).includes("BEGIN PRIVATE KEY"), true);
});

test("a rejected URL is not retried and the error hides the key", async () => {
  resetIndexingTokenCache();
  let publishes = 0;
  const result = await publishIndexNotification({
    url: "https://www.careerspal.com/jobs/role--1",
    type: "URL_UPDATED",
    email: "indexing@example.iam.gserviceaccount.com",
    privateKey: pem,
    sleep: async () => {},
    fetchImpl: async (url) => {
      if (url.includes("oauth2.googleapis.com")) return jsonResponse(200, { access_token: "ya29.test", expires_in: 3600 });
      publishes += 1;
      return jsonResponse(403, { error: pem });
    },
  });
  assert.equal(publishes, 1);
  assert.equal(result.ok, false);
  assert.equal(result.error, "google_rejected_credentials");
  assert.equal(JSON.stringify(result).includes("PRIVATE KEY"), false);
  assert.equal(JSON.stringify(result).includes("ya29"), false);
});

test("rate limits retry and a later success is accepted", async () => {
  resetIndexingTokenCache();
  const statuses: number[] = [];
  const slept: number[] = [];
  const result = await publishIndexNotification({
    url: "https://www.careerspal.com/jobs/role--1",
    type: "URL_DELETED",
    email: "indexing@example.iam.gserviceaccount.com",
    privateKey: pem,
    sleep: async (ms) => {
      slept.push(ms);
    },
    fetchImpl: async (url) => {
      if (url.includes("oauth2.googleapis.com")) return jsonResponse(200, { access_token: "ya29.test", expires_in: 3600 });
      statuses.push(statuses.length === 0 ? 429 : 200);
      return statuses.at(-1) === 429
        ? jsonResponse(429, {}, { "retry-after": "1" })
        : jsonResponse(200, { urlNotificationMetadata: { url: "https://www.careerspal.com/jobs/role--1" } });
    },
  });
  assert.deepEqual(statuses, [429, 200]);
  assert.deepEqual(slept, [1000]);
  assert.equal(result.ok, true);
  assert.equal(result.attempts, 2);
});

test("the quota stops another attempt", async () => {
  resetIndexingTokenCache();
  let used = 0;
  const result = await publishIndexNotification({
    url: "https://www.careerspal.com/jobs/role--1",
    type: "URL_UPDATED",
    email: "indexing@example.iam.gserviceaccount.com",
    privateKey: pem,
    sleep: async () => {},
    canAttempt: () => used < 1,
    noteAttempt: () => {
      used += 1;
    },
    fetchImpl: async (url) => {
      if (url.includes("oauth2.googleapis.com")) return jsonResponse(200, { access_token: "ya29.test", expires_in: 3600 });
      return jsonResponse(503, {});
    },
  });
  assert.equal(used, 1);
  assert.equal(result.attempts, 1);
  assert.equal(result.error, "quota_exhausted");
});
