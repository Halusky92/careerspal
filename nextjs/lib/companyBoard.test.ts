import assert from "node:assert/strict";
import test from "node:test";
import { isBoilerplateDescription, isForeignCompanyBlurb, landedOnAnotherHost, topHiringEmployers } from "./companyBoard";

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

test("a dated product plan is not shown as what the company does", () => {
  assert.equal(
    isBoilerplateDescription(
      "Explore Clover Health 2027 Medicare Advantage PPO plans: $0 to low premiums, dental, vision, OTC allowances and up to $400 in rewards.",
    ),
    true,
  );
  assert.equal(isBoilerplateDescription("Clover Health is a Medicare Advantage company."), false);
});

test("a product slogan is not shown as the company description", () => {
  assert.equal(isBoilerplateDescription("Your intelligent orchestration platform for DevSecOps"), true);
  assert.equal(
    isBoilerplateDescription("Build Custom Agents and automate busywork. The AI workspace where teams get more done, faster."),
    true,
  );
  assert.equal(isBoilerplateDescription("Samsara provides software and hardware tools for companies that manage fleets."), false);
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

test("most relevant employers put a paid Featured Pro company ahead of a larger automatic list", () => {
  const ranked = topHiringEmployers([
    { company: "Automatic Co", companySlug: "automatic", logo: "https://automatic.example/logo.png", origin: "greenhouse" },
    { company: "Automatic Co", companySlug: "automatic", logo: "https://automatic.example/logo.png", origin: "greenhouse" },
    { company: "Automatic Co", companySlug: "automatic", logo: "https://automatic.example/logo.png", origin: "ashby" },
    {
      company: "Pro Co",
      companySlug: "pro",
      logo: "https://pro.example/logo.png",
      origin: "employer",
      planType: "Featured Pro",
      plan: { type: "Featured Pro", price: 149 },
      stripePaymentStatus: "paid",
    },
    {
      company: "Standard Co",
      companySlug: "standard",
      logo: "https://standard.example/logo.png",
      origin: "employer",
      planType: "Standard",
      plan: { type: "Standard", price: 79 },
      stripePaymentStatus: "paid",
    },
    {
      company: "Standard Co",
      companySlug: "standard",
      logo: "https://standard.example/logo.png",
      origin: "employer",
      planType: "Standard",
      plan: { type: "Standard", price: 79 },
      stripePaymentStatus: "paid",
    },
    { company: "No Logo", companySlug: "nologo", origin: "lever" },
    { company: "No Logo", companySlug: "nologo", origin: "lever" },
  ]);
  assert.deepEqual(
    ranked.map((employer) => employer.slug),
    ["pro", "standard", "automatic"],
  );
});
