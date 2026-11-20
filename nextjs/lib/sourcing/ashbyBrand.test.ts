import assert from "node:assert/strict";
import test from "node:test";
import { ashbyBrandFromBoardHtml } from "./ashbyBrand";

const html = `
{"organization":{"name":"Clipboard","publicWebsite":"https://www.clipboardworks.com/careers","theme":{
"logoWordmarkImageUrl":"https://app.ashbyhq.com/api/images/org-theme-wordmark/org/theme/mark.png",
"logoSquareImageUrl":"https://app.ashbyhq.com/api/images/org-theme-logo/org/theme/mark.png"}}}
`;

test("an Ashby board gives its own logo and the site the logo opens", () => {
  const brand = ashbyBrandFromBoardHtml(html);
  assert.equal(brand.website, "https://clipboardworks.com");
  assert.equal(brand.logoUrl, "https://app.ashbyhq.com/api/images/org-theme-wordmark/org/theme/mark.png");
});

test("an Ashby board with no company site still keeps the posting logo", () => {
  const brand = ashbyBrandFromBoardHtml(
    html.replace("https://www.clipboardworks.com/careers", "https://jobs.ashbyhq.com/clipboard"),
  );
  assert.equal(brand.website, null);
  assert.match(brand.logoUrl || "", /org-theme-wordmark/);
});

test("a board page without the Ashby fields stays empty", () => {
  assert.deepEqual(ashbyBrandFromBoardHtml("<html>Clipboard</html>"), { website: null, logoUrl: null });
});
