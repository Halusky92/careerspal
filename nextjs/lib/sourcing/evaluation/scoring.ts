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
  team_text?: string | null;
  salary_present: boolean;
  source_type: string;
  source_validation_state?: string | null;
  source_enabled?: boolean | null;
};

const hasText = (v: string | null | undefined) => Boolean((v || "").trim());

// Positive niche signals (precision > recall). These are matched against title+desc+team+location+remote.
const NicheCore = {
  operations: [
    "operations",
    "business operations",
    "bizops",
    "ops manager",
    "ops lead",
    "operations manager",
    "operational excellence",
    "process design",
    "process improvement",
    "continuous improvement",
    "operating model",
    "internal operations",
  ],
  systems: [
    "systems",
    "business systems",
    "internal tooling",
    "internal tools",
    "tooling",
    "integrations",
    "integration",
    "workflows",
    "workflow",
    "knowledge management",
    "documentation",
    "documentation ops",
    "knowledge base",
    "crm",
    "salesforce",
    "hubspot",
    "netsuite",
    "workday",
    "okta",
    "jira administration",
    "admin (systems)",
  ],
  automation: [
    "automation",
    "automate",
    "workflow automation",
    "zapier",
    "make.com",
    "make ",
    "n8n",
    "rpa",
    "webhooks",
    "api integrations",
  ],
  revops: [
    "revops",
    "revenue operations",
    "gtm operations",
    "sales ops",
    "marketing ops",
    "customer ops",
    "cs ops",
    "pipeline operations",
    "deal desk operations",
    "go-to-market operations",
  ],
  productops: ["product ops", "product operations", "product workflows", "release process", "product enablement (ops)"],
  chief: ["chief of staff", "cos", "office of the ceo", "strategic initiatives", "special projects", "strategy & operations"],
} as const;

// Notion is a supporting signal only (must co-occur with core niche).
const NOTION_SUPPORT = ["notion"];

// Explicit off-niche themes (deny-style). These are strong negatives unless core niche is clearly present.
const NEGATIVE_THEMES_STRONG = [
  // software engineering
  "software engineer",
  "frontend engineer",
  "backend engineer",
  "full stack",
  "full-stack",
  "ios engineer",
  "android engineer",
  "mobile engineer",
  "site reliability",
  "sre",
  "devops engineer",
  "platform engineer",
  "security engineer",
  "ml engineer",
  "machine learning",
  "data scientist",
  "data science",
  // sales
  "account executive",
  "sales development",
  "sdr",
  "bdr",
  // support/cs (generic)
  "customer support",
  "technical support",
  "support specialist",
  "customer success manager",
  // recruiting/hr
  "recruiter",
  "talent",
  "people operations",
  "human resources",
  "hr ",
  // finance/legal
  "accounting",
  "accounts payable",
  "accounts receivable",
  "controller",
  "finance",
  "legal",
  "attorney",
  "paralegal",
  // unrelated marketing
  "paid media",
  "performance marketing",
  "social media",
  "content marketing",
  "brand marketing",
  // manual ops
  "warehouse",
  "retail store",
  "plant",
  "manufacturing",
  "driver",
  "nursing",
];

const NEGATIVE_THEMES_SOFT = ["engineering", "developer", "sales", "marketing", "support", "recruiting", "finance", "legal", "store"];

function textBlob(c: CandidateForScoring): string {
  return [c.title, c.description_clean, c.team_text, c.location_text, c.remote_policy]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
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

  const coreKeywords = Object.values(NicheCore).flat();
  const coreHits = coreKeywords.reduce((acc, kw) => acc + (blob.includes(kw) ? 1 : 0), 0) || 0;
  const notionHit = NOTION_SUPPORT.some((kw) => blob.includes(kw));

  // Strong negative gating: if the role looks like a generic off-niche theme AND we don't have enough core niche evidence, reject.
  const strongNegHits = NEGATIVE_THEMES_STRONG.reduce((acc, kw) => acc + (blob.includes(kw) ? 1 : 0), 0);
  const softNegHits = NEGATIVE_THEMES_SOFT.reduce((acc, kw) => acc + (blob.includes(kw) ? 1 : 0), 0);

  // Notion should never be a standalone pass signal.
  const notionSupport = notionHit && coreHits > 0;

  // Extra safety: allow "marketing ops"/"sales ops"/"revops" even if blob contains "marketing"/"sales".
  const isRevOpsExplicit =
    blob.includes("revops") ||
    blob.includes("revenue operations") ||
    blob.includes("sales ops") ||
    blob.includes("marketing ops") ||
    blob.includes("gtm operations");

  const hasCoreSignal = coreHits >= 2 || (coreHits === 1 && notionSupport);

  const offNicheStrong = strongNegHits > 0 && !hasCoreSignal && !isRevOpsExplicit;
  // If only soft negatives, be conservative: require at least 1 core hit (and not just Notion).
  const offNicheSoft = !offNicheStrong && softNegHits > 0 && coreHits === 0 && !isRevOpsExplicit;

  if (offNicheStrong || offNicheSoft) {
    niche = 0;
    reasons.push("OFF_NICHE");
  } else {
    // Tiering from core niche hits (precision-first).
    if (coreHits >= 5) niche = 30;
    else if (coreHits >= 3) niche = 24;
    else if (coreHits >= 2) niche = 18;
    else if (coreHits === 1) niche = 10;
    else niche = 4;

    // Notion is a supporting boost only.
    if (notionSupport) niche = Math.min(30, niche + 4);

    // If core evidence is weak, mark as low confidence (forces manual review).
    if (coreHits < 2) reasons.push("CAT_LOW_CONF");
    if (niche <= 4) reasons.push("OFF_NICHE");
  }

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

