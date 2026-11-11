import assert from "node:assert/strict";
import test from "node:test";
import { chooseDisplayedLogo, officialWebsiteUrl } from "./companyLogoUrl";
import { preparedLogoRepairs } from "./companyLogoRepair";

test("an ATS address is not stored as the company website", () => {
  assert.equal(officialWebsiteUrl("https://jobs.ashbyhq.com/pomelo-care"), null);
  assert.equal(officialWebsiteUrl("https://www.pomelocare.com/careers"), "https://pomelocare.com");
});

test("a marketing preview is not used as the logo", () => {
  const logo = chooseDisplayedLogo(
    ["https://www.notion.com/front-static/meta/custom-agents-og.png"],
    "https://www.notion.so",
  );
  assert.match(logo || "", /google.com\/s2\/favicons\?domain=notion\.so/);
  assert.equal(
    chooseDisplayedLogo(["https://pomelocare.com/favicon.ico"], "https://pomelocare.com"),
    "https://pomelocare.com/favicon.ico",
  );
});

test("prepared repairs name Pomelo and the bad Notion image only", () => {
  const repairs = preparedLogoRepairs();
  assert.equal(repairs[0]?.companyName, "pomelo-care");
  assert.equal(repairs[0]?.website, "https://pomelocare.com");
  assert.equal(repairs[1]?.onlyIfLogoIncludes, "custom-agents-og.png");
  assert.doesNotMatch(repairs[1]?.logoUrl || "", /custom-agents-og/);
});
