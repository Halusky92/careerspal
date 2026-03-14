export type NotionSignal = {
  notion_mentioned: boolean;
  notion_heavy: boolean;
  hits: {
    context: number;
    systems: number;
    explicit_phrases: number;
  };
};

const CONTEXT = [
  "knowledge base",
  "knowledge management",
  "documentation systems",
  "documentation system",
  "process documentation",
  "documentation",
  "sop",
  "sops",
  "standard operating procedure",
  "runbook",
  "runbooks",
  "playbook",
  "playbooks",
  "handbook",
  "internal wiki",
  "wiki",
  "company os",
  "operating system",
  "workspace",
  "workspace tooling",
  "templates",
];

const SYSTEMS = [
  "internal systems",
  "business systems",
  "systems",
  "internal tooling",
  "internal tools",
  "workflows",
  "workflow",
  "automation",
  "automations",
  "integrations",
  "api",
  "webhook",
  "webhooks",
  "zapier",
  "make.com",
  "n8n",
];

function countIncludes(blob: string, list: string[]) {
  let hits = 0;
  for (const kw of list) if (blob.includes(kw)) hits += 1;
  return hits;
}

export function detectNotionSignal(args: { title?: string | null; description?: string | null; tools?: string[] | null }): NotionSignal {
  const blob = [
    (args.title || "").toString(),
    (args.description || "").toString(),
    Array.isArray(args.tools) ? args.tools.join(" ") : "",
  ]
    .join("\n")
    .toLowerCase();

  const notionMentioned =
    /\bnotion\b/i.test(blob) || blob.includes("notion.so") || blob.includes("notion workspace") || blob.includes("notion database");

  if (!notionMentioned) {
    return { notion_mentioned: false, notion_heavy: false, hits: { context: 0, systems: 0, explicit_phrases: 0 } };
  }

  const contextHits = countIncludes(blob, CONTEXT);
  const systemsHits = countIncludes(blob, SYSTEMS);

  // Explicit “ownership/build” phrases indicate Notion is central, not incidental.
  const explicitPhrases =
    (blob.match(/(own|owning|build|maintain|manage|administer|design|scale)\w{0,20}\s+notion/g) || []).length +
    (blob.match(/notion\s+(workspace|wiki|knowledge base|database|template|templates|system|ops|admin|administrator)/g) || []).length;

  const notionHeavy =
    explicitPhrases > 0 ||
    (contextHits >= 2 && systemsHits >= 1) ||
    contextHits >= 3 ||
    (systemsHits >= 3 && contextHits >= 1);

  return {
    notion_mentioned: true,
    notion_heavy: Boolean(notionHeavy),
    hits: {
      context: contextHits,
      systems: systemsHits,
      explicit_phrases: explicitPhrases,
    },
  };
}

