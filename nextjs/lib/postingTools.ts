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

const MENTION_TOOLS = [
  "Notion",
  "Airtable",
  "Zapier",
  "Make",
  "n8n",
  "Salesforce",
  "HubSpot",
  "NetSuite",
  "Workday",
  "Slack",
  "Jira",
  "Asana",
  "Linear",
  "SQL",
  "Looker",
  "Tableau",
  "Google Sheets",
  "Excel",
  "Snowflake",
  "Segment",
];

function escaped(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function toolIsMentioned(tool: string, text: string): boolean {
  const name = tool.trim();
  const body = text || "";
  if (!name) return false;
  if (/^make$/i.test(name)) return /\bmake\.com\b/i.test(body);
  if (/^google sheets$/i.test(name) || /^sheets$/i.test(name)) return /\bgoogle sheets\b|\bspreadsheets\b/i.test(body);
  return new RegExp(`\\b${escaped(name)}\\b`, "i").test(body);
}

export function toolChipHolds(tool: string, text: string): boolean {
  const name = tool.trim();
  const body = text || "";
  if (!name) return false;
  if (toolIsMentioned(name, body)) return true;
  if (new RegExp(escaped(name), "i").test(body)) return false;
  return true;
}

export function mentionedPostingTools(text: string): string[] {
  return MENTION_TOOLS.filter((tool) => toolIsMentioned(tool, text)).slice(0, 12);
}

export function visiblePostingTools(tools: string[] | null | undefined, text: string): string[] {
  return (tools || []).map((tool) => tool.trim()).filter((tool) => tool && toolIsMentioned(tool, text)).slice(0, 12);
}
