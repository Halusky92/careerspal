import { validateSourceUrl } from "../validator";

const EXTRA_ATS_HOSTS = new Set(["boards-api.greenhouse.io", "api.ashbyhq.com", "api.lever.co"]);

const OFFICIAL_HOSTS = new Set([
  "boards.greenhouse.io",
  "boards.eu.greenhouse.io",
  "job-boards.greenhouse.io",
  "job-boards.eu.greenhouse.io",
  "jobs.ashbyhq.com",
  "jobs.lever.co",
]);

export function isOfficialAtsHost(host: string): boolean {
  const normalized = (host || "").toLowerCase().replace(/^www\./, "");
  return OFFICIAL_HOSTS.has(normalized) || EXTRA_ATS_HOSTS.has(normalized);
}

export type OfficialBoard = {
  provider: "greenhouse" | "ashby" | "lever";
  identifier: string;
  boardUrl: string;
};

function cleanUrlToken(value: string): string {
  return value.replace(/[),.;]+$/g, "").replace(/&amp;/g, "&");
}

/** Keep the public board root. Greenhouse job-board hosts map to the canonical board host. */
export function officialBoardUrl(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(cleanUrlToken(raw));
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (!OFFICIAL_HOSTS.has(host)) return null;
  const token = parsed.pathname.split("/").filter(Boolean)[0];
  if (!token || token === "embed" || token === "v0") return null;
  if (host.endsWith("greenhouse.io")) {
    const canonicalHost = host.includes(".eu.") ? "boards.eu.greenhouse.io" : "boards.greenhouse.io";
    return `https://${canonicalHost}/${token.toLowerCase()}`;
  }
  if (host === "jobs.ashbyhq.com") return `https://jobs.ashbyhq.com/${token}`;
  if (host === "jobs.lever.co") return `https://jobs.lever.co/${token}`;
  return null;
}

export function extractOfficialBoards(html: string): OfficialBoard[] {
  const found = new Map<string, OfficialBoard>();
  const matches = html.match(/https?:\/\/[^\s"'<>]+/gi) || [];
  for (const match of matches) {
    const boardUrl = officialBoardUrl(match);
    if (!boardUrl) continue;
    const validated = validateSourceUrl(boardUrl);
    const provider = validated.detected_ats_type;
    const identifier = (validated.ats_identifier || "").trim();
    if (!validated.source_allowed || validated.denylist_match) continue;
    if (provider !== "greenhouse" && provider !== "ashby" && provider !== "lever") continue;
    if (!identifier) continue;
    const key = `${provider}:${identifier.toLowerCase()}`;
    if (!found.has(key)) found.set(key, { provider, identifier, boardUrl });
  }
  return [...found.values()];
}
