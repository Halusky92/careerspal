export const POSTING_TOOLS = [
  "Notion",
  "Zapier",
  "Make",
  "Airtable",
  "Slack",
  "HubSpot",
  "Salesforce",
  "Asana",
  "ClickUp",
  "n8n",
  "Linear",
  "Jira",
  "Monday.com",
  "Excel",
  "Google Sheets",
  "Looker",
];

const EXTRA_BY_CATEGORY: Record<string, string[]> = {
  Automation: ["Make", "Zapier", "n8n", "Webhooks"],
  "Systems Design": ["Notion", "Airtable", "Salesforce", "Workday"],
  "Marketing & Growth Ops": ["HubSpot", "Salesforce", "Marketo"],
  "Product Management": ["Linear", "Jira", "Notion", "Productboard"],
  Operations: ["Notion", "Asana", "ClickUp", "Slack"],
  "Executive & Staff": ["Notion", "Slack", "Google Workspace"],
};

export function toolsForCategory(category?: string | null) {
  const extra = category ? EXTRA_BY_CATEGORY[category] || [] : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of [...extra, ...POSTING_TOOLS]) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export function toggleTool(selected: string[], raw: string) {
  const name = raw.trim();
  if (!name) return selected;
  const key = name.toLowerCase();
  if (selected.some((item) => item.toLowerCase() === key)) {
    return selected.filter((item) => item.toLowerCase() !== key);
  }
  return [...selected, name];
}

export function toolsToKeywords(selected: string[]) {
  return selected.join(", ");
}
