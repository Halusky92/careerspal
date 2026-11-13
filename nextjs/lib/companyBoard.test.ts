import assert from "node:assert/strict";
import test from "node:test";
import { isBoilerplateDescription, isForeignCompanyBlurb, landedOnAnotherHost } from "./companyBoard";

const walmart = "Shop Walmart.com today for Every Day Low Prices. Join Walmart+ for unlimited free delivery and free shipping with no order minimum.";

test("a storefront promo is rejected for any brand, not only one company", () => {
  assert.equal(isBoilerplateDescription(walmart), true);
  assert.equal(
    isBoilerplateDescription("Join Target.com for free shipping with no order minimum. Start your free trial."),
    true,
  );
  assert.equal(isForeignCompanyBlurb(walmart, "BetterUp", "https://betterup.com"), true);
  assert.equal(isForeignCompanyBlurb("Join Target.com today.", "BetterUp"), true);
});

test("a company's own site blurb is kept", () => {
  const own = "BetterUp helps people grow with coaching at work.";
  assert.equal(isBoilerplateDescription(own), false);
  assert.equal(isForeignCompanyBlurb(own, "BetterUp", "https://www.betterup.com"), false);
  assert.equal(isForeignCompanyBlurb("Visit betterup.com to learn about coaching.", "BetterUp", "https://betterup.com"), false);
});

test("a fetch that lands on another site is not used as the company description", () => {
  assert.equal(landedOnAnotherHost("https://betterup.com", "https://www.walmart.com/"), true);
  assert.equal(landedOnAnotherHost("https://betterup.com", "https://www.betterup.com/about"), false);
  assert.equal(landedOnAnotherHost("https://betterup.com", "https://careers.betterup.com/jobs"), false);
});
