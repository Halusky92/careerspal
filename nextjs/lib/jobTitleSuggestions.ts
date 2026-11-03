/** Curated Ops/Systems titles for the posting form autocomplete. */
export const JOB_TITLE_SUGGESTIONS = [
  "Operations Manager",
  "Head of Operations",
  "Director of Operations",
  "Chief of Staff",
  "Revenue Operations Manager",
  "RevOps Manager",
  "Sales Operations Manager",
  "Sales Ops Analyst",
  "Marketing Operations Manager",
  "Marketing Ops Specialist",
  "Product Operations Manager",
  "Product Ops Lead",
  "Business Operations Manager",
  "BizOps Analyst",
  "GTM Operations Manager",
  "Customer Operations Manager",
  "Customer Success Operations",
  "Systems Analyst",
  "Business Systems Analyst",
  "Workflow Automation Specialist",
  "Automation Engineer",
  "Automation Specialist",
  "Internal Tools Manager",
  "Technical Operations Manager",
  "Support Operations Lead",
  "Strategy and Operations Manager",
  "Operations Analyst",
  "Operations Coordinator",
  "Deal Desk Manager",
];

export function filterJobTitleSuggestions(query: string, extra: string[] = [], limit = 8) {
  const seen = new Set<string>();
  const pool: string[] = [];
  for (const title of [...extra, ...JOB_TITLE_SUGGESTIONS]) {
    const trimmed = (title || "").trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    pool.push(trimmed);
  }
  const q = query.trim().toLowerCase();
  const matched = q
    ? pool.filter((title) => title.toLowerCase().includes(q) && title.toLowerCase() !== q)
    : pool;
  return matched.slice(0, limit);
}
