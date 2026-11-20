import assert from "node:assert/strict";
import test from "node:test";
import { classifyCompanyMatch, companyIdentityKey } from "./companyMatch";

const notion = { id: "notion", name: "Notion", website: "https://notion.so" };
const notionWave = { id: "wave", name: "NotionWave", website: "https://notionwave.example" };

test("Notion and NotionWave stay separate", () => {
  assert.notEqual(companyIdentityKey("Notion"), companyIdentityKey("NotionWave"));
  assert.equal(classifyCompanyMatch({ name: "Notion" }, [notion, notionWave]).status, "match");
  const wave = classifyCompanyMatch({ name: "NotionWave" }, [notion, notionWave]);
  assert.equal(wave.status, "match");
  if (wave.status === "match") assert.equal(wave.companyId, "wave");
});

test("a legal suffix matches one company and a shared name does not", () => {
  const match = classifyCompanyMatch({ name: "SewerAI Corporation" }, [{ id: "sewer", name: "SewerAI", website: "https://sewerai.com" }]);
  assert.equal(match.status, "match");
  const ambiguous = classifyCompanyMatch({ name: "Acme" }, [
    { id: "a", name: "Acme" },
    { id: "b", name: "Acme Inc" },
  ]);
  assert.equal(ambiguous.status, "ambiguous");
});

test("domain and ATS identifier match the existing company", () => {
  const byDomain = classifyCompanyMatch({ name: "Clipboard Works", website: "https://www.clipboardworks.com" }, [
    { id: "clip", name: "Clipboard", website: "https://clipboardworks.com" },
  ]);
  assert.equal(byDomain.status, "match");
  const byAts = classifyCompanyMatch({ name: "Somewhere", atsIdentifier: "clipboard" }, [
    { id: "clip", name: "Clipboard", atsIdentifiers: ["clipboard"] },
  ]);
  assert.equal(byAts.status, "match");
});

test("an ATS host is not a company domain", () => {
  assert.equal(
    classifyCompanyMatch({ website: "https://jobs.ashbyhq.com/clipboard" }, [notion]).status,
    "none",
  );
});

test("disagreeing signals stay in review", () => {
  const result = classifyCompanyMatch({ name: "Notion", website: "https://notionwave.example" }, [notion, notionWave]);
  assert.equal(result.status, "ambiguous");
});
