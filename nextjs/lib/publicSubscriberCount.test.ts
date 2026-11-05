import assert from "node:assert/strict";
import test from "node:test";
import {
  formatPublicSubscriberLine,
  PUBLIC_SUBSCRIBER_THRESHOLD,
  publicSubscriberCount,
  uniqueConfirmedSubscriberEmails,
} from "./publicSubscriberCount";

test("hides subscriber counts below the public threshold", () => {
  assert.equal(publicSubscriberCount(0), null);
  assert.equal(publicSubscriberCount(PUBLIC_SUBSCRIBER_THRESHOLD - 1), null);
});

test("shows the live subscriber count once the threshold is met", () => {
  assert.equal(publicSubscriberCount(PUBLIC_SUBSCRIBER_THRESHOLD), 25);
  assert.equal(publicSubscriberCount(41), 41);
});

test("counts confirmed subscribers and logged-in alert emails once", () => {
  const emails = uniqueConfirmedSubscriberEmails(
    [
      { email: "A@careerspal.com", preference: JSON.stringify({ confirmed: true, token: "aa" }) },
      { email: "pending@careerspal.com", preference: JSON.stringify({ confirmed: false, token: "bb" }) },
      { email: "a@careerspal.com", preference: JSON.stringify({ token: "cc" }) },
    ],
    ["pending@careerspal.com", "c@careerspal.com", ""],
  );
  assert.deepEqual(emails.sort(), ["a@careerspal.com", "c@careerspal.com", "pending@careerspal.com"]);
});

test("does not count unconfirmed guests until they confirm or have a saved account alert", () => {
  const emails = uniqueConfirmedSubscriberEmails([
    { email: "pending@careerspal.com", preference: JSON.stringify({ confirmed: false, token: "bb" }) },
  ]);
  assert.deepEqual(emails, []);
});

test("keeps the public line empty until a count can be shown", () => {
  assert.equal(formatPublicSubscriberLine(null), null);
  assert.equal(formatPublicSubscriberLine(32), "32 people currently get these email alerts.");
});
