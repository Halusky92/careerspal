import { SOURCING_SEED_BOARDS } from "../seedBoards";
import { officialBoardUrl, type OfficialBoard } from "./atsLinks";
import { validateSourceUrl } from "../validator";
import type { DiscoveryReview } from "./review";

/** Daily discovery cron in Europe/Bratislava. The workflow owns the timezone. */
export const DISCOVERY_CADENCE = "5 1 * * *";
export const DAILY_SEARCH_CAP = 20;
export const MONTHLY_SEARCH_CAP = 620;
export const BOARDS_PER_GROUP = 4;
export const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
export const ZERO_STREAK_TO_COOL = 2;
export const STAGING_HOST = "rpwutygkiiphqdphitdg.supabase.co";
export const PRODUCTION_REF = "uahdliiwhvviinujtyjj";

export const DISCOVERY_DOMAINS = [
  "boards.greenhouse.io",
  "boards.eu.greenhouse.io",
  "job-boards.greenhouse.io",
  "job-boards.eu.greenhouse.io",
  "jobs.ashbyhq.com",
  "jobs.lever.co",
];

export const AGGREGATOR_TOKENS = new Set(["jobgether"]);

export const DISCOVERY_GROUPS = [
  {
    id: "revops",
    phrases: [
      "Revenue Operations Manager remote United States",
      "RevOps Manager remote United States",
      "Revenue Operations Lead remote United States",
    ],
  },
  {
    id: "sales-ops",
    phrases: [
      "Sales Operations Manager remote United States",
      "Deal Desk Manager remote United States",
      "Sales Operations Lead remote United States",
    ],
  },
  {
    id: "bizops",
    phrases: [
      "Business Operations Manager remote United States",
      "BizOps Manager remote United States",
      "Business Operations Lead remote United States",
    ],
  },
  {
    id: "chief-of-staff",
    phrases: [
      "Chief of Staff remote United States",
      "Chief of Staff to the CEO remote United States",
      "Head of Staff remote United States",
    ],
  },
  {
    id: "product-ops",
    phrases: [
      "Product Operations Manager remote United States",
      "Product Ops Manager remote United States",
      "Product Operations Lead remote United States",
    ],
  },
  {
    id: "systems",
    phrases: [
      "Business Systems Analyst remote United States",
      "Business Systems Manager remote United States",
      "Systems Analyst business systems remote United States",
    ],
  },
  {
    id: "automation",
    phrases: [
      "Workflow Automation Specialist remote United States",
      "Automation Specialist remote United States",
      "Marketing Automation Manager remote United States",
    ],
  },
  {
    id: "gtm-ops",
    phrases: [
      "GTM Operations Manager remote United States",
      "Go-to-market Operations Manager remote United States",
      "GTM Ops Lead remote United States",
    ],
  },
] as const;

export type PhraseState = {
  variantIndex: number;
  zeroNewStreak: number;
  cooledUntil: string | null;
  updatedAt?: string | null;
};

export function rotateDiscoveryGroups<T>(groups: readonly T[], now: Date): T[] {
  if (groups.length < 2) return [...groups];
  const start = Math.floor(now.getTime() / 86_400_000) % groups.length;
  return [...groups.slice(start), ...groups.slice(0, start)];
}

export function sameUtcDay(iso: string | null | undefined, now: Date) {
  if (!iso) return false;
  const then = new Date(iso);
  return !Number.isNaN(then.getTime()) && then.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
}

export type SearchHit = { url: string; title: string };

const TOKEN_RE = /^[a-z0-9][a-z0-9_-]{1,60}$/;

export function seedBoardKeys(): Set<string> {
  return new Set(SOURCING_SEED_BOARDS.map((board) => `${board.sourceType}:${board.atsIdentifier.toLowerCase()}`));
}

export function assertStagingDatabaseUrl(url: string) {
  let host = "";
  try {
    host = new URL(url).host;
  } catch {
    host = "";
  }
  if (host !== STAGING_HOST || url.includes(PRODUCTION_REF)) {
    throw new Error(`REFUSED database host ${host || "missing"}`);
  }
}

/** Explicit production entry only. Staging and every other host are refused. */
export function assertProductionDatabaseUrl(url: string) {
  let host = "";
  try {
    host = new URL(url).host;
  } catch {
    host = "";
  }
  if (host !== `${PRODUCTION_REF}.supabase.co` || url.includes(STAGING_HOST)) {
    throw new Error(`REFUSED database host ${host || "missing"}`);
  }
}

export function claimSearchSlot(count: number, cap = MONTHLY_SEARCH_CAP) {
  if (count >= cap) return { ok: false as const, next: count };
  return { ok: true as const, next: count + 1 };
}

export function phraseForGroup(phrases: readonly string[], state: PhraseState | undefined, now: Date) {
  const current = state || { variantIndex: 0, zeroNewStreak: 0, cooledUntil: null };
  if (current.cooledUntil && Date.parse(current.cooledUntil) > now.getTime()) return null;
  const variantIndex = current.variantIndex % phrases.length;
  return { phrase: phrases[variantIndex], variantIndex };
}

export function nextPhraseState(previous: PhraseState | undefined, variantIndex: number, phraseCount: number, newBoards: number, now: Date): PhraseState {
  const streak = newBoards > 0 ? 0 : (previous?.zeroNewStreak || 0) + 1;
  const cool = streak >= ZERO_STREAK_TO_COOL;
  return {
    variantIndex: (variantIndex + 1) % phraseCount,
    zeroNewStreak: cool ? 0 : streak,
    cooledUntil: cool ? new Date(now.getTime() + COOLDOWN_MS).toISOString() : null,
  };
}

export function boardFromHit(raw: string): OfficialBoard | null {
  const boardUrl = officialBoardUrl(raw);
  if (!boardUrl) return null;
  const validated = validateSourceUrl(boardUrl);
  const provider = validated.detected_ats_type;
  const identifier = (validated.ats_identifier || "").trim();
  if (!validated.source_allowed || validated.denylist_match) return null;
  if (provider !== "greenhouse" && provider !== "ashby" && provider !== "lever") return null;
  if (!TOKEN_RE.test(identifier)) return null;
  if (AGGREGATOR_TOKENS.has(identifier.toLowerCase())) return null;
  return { provider, identifier, boardUrl };
}

export function selectNewBoards(hits: SearchHit[], known: Set<string>, limit = BOARDS_PER_GROUP) {
  const chosen: Array<OfficialBoard & { searchTitle: string; foundUrl: string }> = [];
  for (const hit of hits) {
    const board = boardFromHit(hit.url);
    if (!board) continue;
    const key = `${board.provider}:${board.identifier.toLowerCase()}`;
    if (known.has(key)) continue;
    known.add(key);
    chosen.push({ ...board, searchTitle: hit.title, foundUrl: hit.url });
    if (chosen.length >= limit) break;
  }
  return chosen;
}

export async function runJobFirstDiscovery(args: {
  now: Date;
  monthCount: number;
  phrases: Record<string, PhraseState | undefined>;
  known: Set<string>;
  search: (query: string) => Promise<SearchHit[]>;
  review: (board: OfficialBoard) => Promise<DiscoveryReview>;
  cap?: number;
  maxSearches?: number;
  maxBoards?: number;
  groups?: ReadonlyArray<{ id: string; phrases: readonly string[] }>;
  oncePerDay?: boolean;
  claim?: () => Promise<boolean>;
  onGroup?: (groupId: string, update: PhraseState | null, info: { phrase: string | null; boards: number; qualifying: number; skipped: string }) => Promise<void>;
}) {
  const cap = args.cap ?? MONTHLY_SEARCH_CAP;
  let monthCount = args.monthCount;
  const phraseUpdates: Record<string, PhraseState> = {};
  const pending: DiscoveryReview[] = [];
  const groups: Array<{ id: string; phrase: string | null; boards: number; qualifying: number; skipped: string }> = [];
  let searches = 0;
  let reviewed = 0;
  let stopped: string | null = null;
  const livePhrases: Record<string, PhraseState | undefined> = { ...args.phrases };
  const usedPhrases = new Set<string>();
  const notedSkips = new Set<string>();
  const groupList = args.groups ?? DISCOVERY_GROUPS;

  for (let pass = 0; pass < 8 && !stopped && !(typeof args.maxSearches === "number" && searches >= args.maxSearches); pass += 1) {
    let addedSearch = false;
    for (const group of groupList) {
      if (!stopped && typeof args.maxSearches === "number" && searches >= args.maxSearches) stopped = "search_cap";
      if (!stopped && typeof args.maxBoards === "number" && reviewed >= args.maxBoards) stopped = "board_cap";
      if (stopped) {
        if (!notedSkips.has(`${group.id}:${stopped}`)) {
          groups.push({ id: group.id, phrase: null, boards: 0, qualifying: 0, skipped: stopped });
          notedSkips.add(`${group.id}:${stopped}`);
        }
        continue;
      }
      if (args.oncePerDay && sameUtcDay(args.phrases[group.id]?.updatedAt, args.now)) {
        if (!notedSkips.has(`${group.id}:already_today`)) {
          groups.push({ id: group.id, phrase: null, boards: 0, qualifying: 0, skipped: "already_today" });
          notedSkips.add(`${group.id}:already_today`);
        }
        continue;
      }
      const picked = phraseForGroup(group.phrases, livePhrases[group.id], args.now);
      if (!picked) {
        if (!notedSkips.has(`${group.id}:cooled`)) {
          const info = { id: group.id, phrase: null, boards: 0, qualifying: 0, skipped: "cooled" };
          groups.push(info);
          notedSkips.add(`${group.id}:cooled`);
          await args.onGroup?.(group.id, null, info);
        }
        continue;
      }
      const phraseKey = `${group.id}:${picked.phrase}`;
      if (usedPhrases.has(phraseKey)) continue;
      const claimed = args.claim ? await args.claim() : claimSearchSlot(monthCount, cap).ok;
      if (!claimed) {
        stopped = "monthly_cap";
        groups.push({ id: group.id, phrase: picked.phrase, boards: 0, qualifying: 0, skipped: "monthly_cap" });
        notedSkips.add(`${group.id}:monthly_cap`);
        continue;
      }
      if (!args.claim) monthCount = claimSearchSlot(monthCount, cap).next;
      usedPhrases.add(phraseKey);
      searches += 1;
      addedSearch = true;
      const hits = await args.search(picked.phrase);
      const room = typeof args.maxBoards === "number" ? Math.min(BOARDS_PER_GROUP, args.maxBoards - reviewed) : BOARDS_PER_GROUP;
      const boards = selectNewBoards(hits, args.known, room);
      reviewed += boards.length;
      let qualifying = 0;
      for (const board of boards) {
        const review = await args.review(board);
        qualifying += review.qualifyingJobCount;
        if (review.decision === "pending_approval") pending.push(review);
      }
      const update = nextPhraseState(livePhrases[group.id], picked.variantIndex, group.phrases.length, boards.length, args.now);
      livePhrases[group.id] = { ...update, updatedAt: args.now.toISOString() };
      phraseUpdates[group.id] = update;
      const info = { id: group.id, phrase: picked.phrase, boards: boards.length, qualifying, skipped: "" };
      groups.push(info);
      await args.onGroup?.(group.id, update, info);
    }
    if (!addedSearch) break;
  }

  return { searches, stopped, groups, pending, phraseUpdates, endingCount: monthCount };
}
