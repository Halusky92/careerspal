import type { ReasonCode } from "./reasonCodes";

export type ScoreBreakdown = {
  niche_relevance: number; // 0-30
  salary_transparency: number; // 0-20
  remote_clarity: number; // 0-15
  source_trust: number; // 0-15
  metadata_completeness: number; // 0-10
  direct_employer_confidence: number; // 0-10
};

export type CandidateForScoring = {
  title: string | null;
  company_name: string | null;
  apply_url: string | null;
  job_url: string | null;
  location_text: string | null;
  remote_policy: string | null;
  description_clean: string | null;
  salary_present: boolean;
  source_type: string;
  source_validation_state?: string | null;
  source_enabled?: boolean | null;
};

const hasText = (v: string | null | undefined) => Boolean((v || "").trim());

const Niche = {
  operations: ["operations", "bizops", "business operations", "ops manager", "ops lead", "operator"],
  systems: ["systems", "business systems", "crm", "salesforce", "hubspot", "netsuite", "workday", "integrations"],
  automation: ["automation", "zapier", "make.com", "n8n", "workflows", "webhooks", "rpa"],
  revops: ["revops", "revenue operations", "gtm operations", "sales ops", "marketing ops", "cs ops", "pipeline"],
  productops: ["product ops", "product operations", "release process", "product workflows"],
  chief: ["chief of staff", "cos", "office of the ceo", "strategic initiatives", "special projects"],
} as const;

const NEGATIVE_OFF_NICHE = ["warehouse", "plant", "manufacturing", "retail store", "driver", "nursing"];

function textBlob(c: CandidateForScoring): string {
  return [c.title, c.description_clean, c.location_text, c.remote_policy].filter(Boolean).join(" ").toLowerCase();
}

export function scoreCandidate(c: CandidateForScoring): {
  total: number;
  breakdown: ScoreBreakdown;
  reasons: ReasonCode[];
} {
  const reasons: ReasonCode[] = [];
  const blob = textBlob(c);

  // Niche relevance 0-30
  let niche = 0;
  const posHits =
    Object.values(Niche)
      .flat()
      .reduce((acc, kw) => acc + (blob.includes(kw) ? 1 : 0), 0) || 0;
  const negHits = NEGATIVE_OFF_NICHE.reduce((acc, kw) => acc + (blob.includes(kw) ? 1 : 0), 0);

  if (negHits > 0 && posHits === 0) niche = 0;
  else if (posHits >= 4) niche = 30;
  else if (posHits >= 2) niche = 22;
  else if (posHits === 1) niche = 14;
  else niche = 6;

  if (niche <= 6) reasons.push("OFF_NICHE");

  // Salary transparency 0-20
  const salary = c.salary_present ? 20 : 0;
  if (!c.salary_present) reasons.push("SALARY_MISSING");

  // Remote clarity 0-15
  let remote = 6;
  const rp = (c.remote_policy || "").toLowerCase();
  const loc = (c.location_text || "").toLowerCase();
  if (rp.includes("remote") || loc.includes("remote")) remote = 15;
  else if (rp.includes("hybrid") || loc.includes("hybrid") || rp.includes("onsite") || loc.includes("onsite")) remote = 2;
  else if (!hasText(c.remote_policy) && !hasText(c.location_text)) remote = 4;

  if (remote <= 4) reasons.push("REMOTE_UNCLEAR");
  if (rp.includes("onsite") || loc.includes("onsite")) reasons.push("ONSITE_ONLY");

  // Source trust 0-15 (conservative)
  let sourceTrust = 5;
  if (["greenhouse", "lever", "ashby", "workable"].includes((c.source_type || "").toLowerCase())) sourceTrust = 15;
  else if ((c.source_type || "").toLowerCase() === "direct_custom") sourceTrust = 10;
  else sourceTrust = 5;

  if (c.source_validation_state && c.source_validation_state !== "allowed") sourceTrust = Math.min(sourceTrust, 6);
  if (c.source_enabled === false) sourceTrust = Math.min(sourceTrust, 6);

  if (sourceTrust <= 6) reasons.push("SOURCE_WEAK");

  // Metadata completeness 0-10
  let meta = 0;
  meta += hasText(c.title) ? 3 : 0;
  meta += hasText(c.company_name) ? 2 : 0;
  meta += hasText(c.apply_url) ? 3 : 0;
  meta += hasText(c.description_clean) && (c.description_clean || "").trim().length >= 200 ? 2 : 0;
  if (meta <= 5) reasons.push("METADATA_WEAK");
  if (!hasText(c.apply_url)) reasons.push("APPLY_MISSING");

  // Direct employer confidence 0-10
  let employer = 0;
  if (["greenhouse", "lever", "ashby", "workable"].includes((c.source_type || "").toLowerCase())) employer = 10;
  else if ((c.source_type || "").toLowerCase() === "direct_custom") employer = 6;
  else employer = 2;

  const breakdown: ScoreBreakdown = {
    niche_relevance: niche,
    salary_transparency: salary,
    remote_clarity: remote,
    source_trust: sourceTrust,
    metadata_completeness: meta,
    direct_employer_confidence: employer,
  };

  const total = Math.max(
    0,
    Math.min(
      100,
      breakdown.niche_relevance +
        breakdown.salary_transparency +
        breakdown.remote_clarity +
        breakdown.source_trust +
        breakdown.metadata_completeness +
        breakdown.direct_employer_confidence,
    ),
  );

  // Positive flags (informational)
  if (total >= 75 && !reasons.includes("APPLY_MISSING") && !reasons.includes("OFF_NICHE")) reasons.push("LIKELY_GOOD");

  return { total, breakdown, reasons: Array.from(new Set(reasons)) };
}

