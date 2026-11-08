import assert from "node:assert/strict";
import test from "node:test";
import { isLikelyBot } from "./trafficBots";

test("empty and tiny user agents are not counted as people", () => {
  assert.equal(isLikelyBot(""), true);
  assert.equal(isLikelyBot("curl"), true);
});

test("common crawlers are bots", () => {
  assert.equal(isLikelyBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://google.com/bot.html)"), true);
  assert.equal(isLikelyBot("GPTBot/1.0"), true);
});

test("a normal browser is not a bot", () => {
  assert.equal(
    isLikelyBot(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    ),
    false,
  );
});
