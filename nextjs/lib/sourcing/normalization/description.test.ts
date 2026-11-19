import assert from "node:assert/strict";
import test from "node:test";
import { extractJobDetailSections, formatSourcedDescription, rolePreviewBullets } from "./description";

test("Greenhouse vendor copy is dropped from sourced descriptions", () => {
  const text = formatSourcedDescription(
    "Own the ops calendar.\n\nGreenhouse is the talent operating system that helps companies hire.\n\nYou will run weekly reviews.",
  );
  assert.equal(text.includes("talent operating system"), false);
  assert.match(text, /ops calendar/);
});

test("a sentence that starts with a heading word stays a sentence", () => {
  const salary = formatSourcedDescription(
    "SALARY AND WORKING ARRANGEMENT\nBenefits for this role is expected to range from $135,000-$210,000.",
  );
  assert.match(salary, /Benefits for this role is expected/);
  assert.equal(salary.includes("Benefits:\nfor this role"), false);
  const sections = extractJobDetailSections(salary);
  assert.equal(sections.some((section) => section.body.startsWith("for this role")), false);

  const role = formatSourcedDescription("The role:\ncombines building new systems and improving existing ones.");
  assert.match(role, /The role combines building/);
  assert.equal(role.includes("\ncombines"), false);
});

test("inline hyphen bullets stay in one list and legal boilerplate is dropped", () => {
  const text = formatSourcedDescription(
    "What you'll do: Lead the projects. Historical projects include: - Oversee due diligence. - Develop the European market entry strategy. Benefits: - ** Medical, dental, and vision - Flexible paid time off. BetterUp Inc. provides equal employment opportunities (EEO) to all employees and applicants.",
  );
  assert.match(text, /^- Oversee due diligence\./m);
  assert.match(text, /^- Develop the European market entry strategy\./m);
  assert.equal(text.includes("\n-\n"), false);
  assert.match(text, /Medical, dental/);
  assert.equal(text.includes("**"), false);
  assert.equal(text.includes("equal employment"), false);
  assert.equal(formatSourcedDescription("You&#x27;re always thinking.").includes("&#x27;"), false);
});

test("a currency range keeps its hyphen instead of becoming two paragraphs", () => {
  const text = formatSourcedDescription("Canada : CA$150.5K - CA$215K base");
  assert.match(text, /CA\$150\.5K - CA\$215K/);
  assert.equal(text.includes("\n- CA$"), false);
});

test("a lone dash becomes the bullet for the next line", () => {
  const text = formatSourcedDescription("What you'll do\n-\nOwn the weekly review");
  assert.match(text, /^- Own the weekly review/m);
  assert.equal(text.includes("\n-\n"), false);
});

test("decorative underscore lines are removed", () => {
  const text = formatSourcedDescription("About Docker\n_______________________________________________________________________\nWe are seeking a Senior Manager.");
  assert.equal(text.includes("____"), false);
  assert.match(text, /Senior Manager/);
});

test("a short list label becomes a heading and a split language bullet stays one item", () => {
  const text = formatSourcedDescription(
    "Skills You'll Need to Bring\n- You have 4+ years in product operations.\n\nNice To Haves\n- Knowledge of and experience using one or more of the following languages\n- Python, Go, C++ or Java\n\n#LI-Onsite\n\nBy clicking Submit Application, you agree to the recruiting privacy policy.\n\nNotion is an equal opportunity employer and does not discriminate.",
  );
  assert.match(text, /Skills You'll Need to Bring:/);
  assert.match(text, /Nice To Haves:/);
  assert.match(text, /following languages: Python, Go, C\+\+ or Java/);
  assert.equal(text.includes("#LI-"), false);
  assert.equal(text.includes("Submit Application"), false);
  assert.equal(text.includes("equal opportunity"), false);
  assert.equal(
    formatSourcedDescription("We still encourage you to apply. Notion considers qualified applicants with criminal histories, consistent with applicable law.").includes("criminal"),
    false,
  );
});

test("a line between bullets stays a bullet and a space before a period is closed", () => {
  const text = formatSourcedDescription("- Own the forecast\nReport the weekly variance\n- Keep the close calendar");
  assert.match(text, /^- Report the weekly variance/m);
  assert.equal(formatSourcedDescription("The team ships on time ."), "The team ships on time.");
});

test("named ATS headings become job-detail sections", () => {
  const sections = extractJobDetailSections(
    "About the role\nRun the weekly ops review.\n\nWhat you'll do\n- Build the tracker\n\nRequirements\n- SQL",
  );
  assert.equal(sections.length >= 2, true);
  assert.equal(sections[0]?.heading, "About the role");
  assert.equal(sections.some((s) => s.heading === "What you'll do"), true);
});

test("a card preview keeps the duties and leaves the company intro out", () => {
  const bullets = rolePreviewBullets(
    "About Equip\nEquip is the leading virtual treatment program.\n\nWhat you'll do\n- Map the revenue process from lead to cash\n- Write requirements the sales team can follow\n- Keep the weekly operating review\n\nBenefits\n- Medical, dental, and vision\n\nWe are an equal opportunity employer.",
  );
  assert.deepEqual(bullets, [
    "Map the revenue process from lead to cash",
    "Write requirements the sales team can follow",
    "Keep the weekly operating review",
  ]);
});
