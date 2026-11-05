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
  "Operations Process Specialist",
  "Operations Project Manager",
  "Operations Program Manager",
  "Deal Desk Manager",
];

export const TITLES_BY_CATEGORY: Record<string, string[]> = {
  Operations: [
    "Operations Manager",
    "Head of Operations",
    "Director of Operations",
    "Business Operations Manager",
    "BizOps Analyst",
    "Operations Analyst",
    "Operations Coordinator",
    "Operations Process Specialist",
    "Operations Project Manager",
    "Operations Program Manager",
    "Strategy and Operations Manager",
  ],
  "Systems Design": [
    "Business Systems Analyst",
    "Systems Analyst",
    "Internal Tools Manager",
    "Technical Operations Manager",
    "Workflow Automation Specialist",
  ],
  Automation: [
    "Workflow Automation Specialist",
    "Automation Engineer",
    "Automation Specialist",
    "Internal Tools Manager",
  ],
  "Marketing & Growth Ops": [
    "Revenue Operations Manager",
    "RevOps Manager",
    "Sales Operations Manager",
    "Sales Ops Analyst",
    "Marketing Operations Manager",
    "Marketing Ops Specialist",
    "GTM Operations Manager",
    "Deal Desk Manager",
  ],
  "Product Management": [
    "Product Operations Manager",
    "Product Ops Lead",
    "Business Operations Manager",
  ],
  "Executive & Staff": [
    "Chief of Staff",
    "Head of Operations",
    "Director of Operations",
    "Strategy and Operations Manager",
  ],
};

export function filterJobTitleSuggestions(
  query: string,
  extra: string[] = [],
  limit = 8,
  category?: string | null,
) {
  const categoryPool = category ? TITLES_BY_CATEGORY[category] || [] : [];
  const seen = new Set<string>();
  const pool: string[] = [];
  for (const title of [...categoryPool, ...extra, ...JOB_TITLE_SUGGESTIONS]) {
    const trimmed = (title || "").trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    pool.push(trimmed);
  }
  const q = query.trim().toLowerCase();
  const ranked = pool
    .map((title, index) => {
      const t = title.toLowerCase();
      let score = 0;
      const categoryIndex = categoryPool.findIndex((item) => item.toLowerCase() === t);
      if (categoryIndex >= 0) score += 20 - Math.min(categoryIndex, 9);
      if (!q) return { title, score: score + 1, index };
      if (t === q) return { title, score: score + 12, index };
      if (t.startsWith(q)) score += 8;
      else if (t.includes(q)) score += 4;
      else return { title, score: -1, index };
      return { title, score, index };
    })
    .filter((row) => row.score >= 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  return ranked.slice(0, limit).map((row) => row.title);
}
