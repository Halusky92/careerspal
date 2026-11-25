import { randomUUID } from "crypto";
import type { Job } from "../types";
import { coordinateBoardBuild } from "./boardIndexCoordinator";
import { addJobToCompany, type BoardCompany } from "./companyBoard";
import { createCompanySlug } from "./jobs";
import { applyLiveBoardFilter, isLiveBoardJob } from "./liveBoard";
import { isOnNicheJob } from "./nicheScope";
import { supabaseAdmin } from "./supabaseAdmin";
import { mapSupabaseJob, type SupabaseJobRow } from "./supabaseJobs";
import { toBoardCard } from "./boardListQuery";

type AdminSb = NonNullable<typeof supabaseAdmin>;

const INDEX_PAGE = 200;
const INDEX_MAX_ROWS = 20000;

/** Card columns. The posting body is read once while the index is built, then dropped. */
export const BOARD_CARD_SELECT =
  "id,title,location,remote_policy,type,salary,posted_at_text,timestamp,published_at,created_at,updated_at,category,apply_url,company_website,logo_url,tags,tools,keywords,match_score,is_featured,status,plan_type,plan_price,plan_currency,origin,company_id,companies(name,slug,logo_url,website,description,verified,location)";

const companyOf = (row: SupabaseJobRow & { companies?: { location?: string | null } | null }) => {
  const rel = row.companies as { location?: string | null } | { location?: string | null }[] | null | undefined;
  return Array.isArray(rel) ? rel[0] : rel;
};

async function descriptionsFor(sb: AdminSb, ids: string[]) {
  const found = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { data, error } = await sb.from("jobs").select("id,description").in("id", chunk);
    if (error) return found;
    for (const row of data || []) {
      if (row?.id) found.set(String(row.id), String(row.description || ""));
    }
  }
  return found;
}

/** Pages the live published table, keeps niche rows, and stores cards without descriptions. */
export async function loadBoardIndex(sb: AdminSb): Promise<Job[]> {
  const rows: Array<SupabaseJobRow & { updated_at?: string | null; company_id?: string | null }> = [];
  for (let offset = 0; offset < INDEX_MAX_ROWS; offset += INDEX_PAGE) {
    const { data, error } = await applyLiveBoardFilter(
      sb.from("jobs").select(BOARD_CARD_SELECT).eq("status", "published").order("timestamp", { ascending: false }),
    ).range(offset, offset + INDEX_PAGE - 1);
    if (error) throw new Error(error.message);
    const page = (data as unknown as typeof rows | null) || [];
    rows.push(...page);
    if (page.length < INDEX_PAGE) break;
  }
  const descriptions = await descriptionsFor(
    sb,
    rows.map((row) => row.id),
  );
  const cards: Job[] = [];
  for (const row of rows) {
    if (!isLiveBoardJob(row)) continue;
    const company = companyOf(row);
    const mapped = mapSupabaseJob({ ...row, description: descriptions.get(row.id) || "" });
    if (!isOnNicheJob(mapped)) continue;
    const card = toBoardCard(mapped);
    card.updatedAt = row.updated_at || undefined;
    card.companyLocation = company?.location || undefined;
    card.companyId = card.companyId || row.company_id || undefined;
    cards.push(card);
  }
  return cards;
}

const SNAPSHOT_ID = "public";

type SnapshotMeta = {
  builtAt: number;
  sourceUpdatedAt: string | null;
  leaseUntil: number;
  payload: Job[] | null;
};

let leaseMode: "unknown" | "on" | "off" = "unknown";
let localCards: { builtAt: number; cards: Job[] } | null = null;
let localFlight: Promise<Job[]> | null = null;

const missingLease = (error: { code?: string; message?: string } | null) => {
  const code = error?.code || "";
  const message = (error?.message || "").toLowerCase();
  return code === "42P01" || code === "PGRST202" || code === "PGRST205" || message.includes("board_index");
};

async function latestJobUpdate(sb: AdminSb) {
  const { data, error } = await sb.from("jobs").select("updated_at").order("updated_at", { ascending: false }).limit(1);
  if (error) throw new Error(error.message);
  const value = data?.[0]?.updated_at;
  return typeof value === "string" && value ? value : null;
}

function metaFrom(row: {
  built_at?: string | null;
  source_updated_at?: string | null;
  lease_until?: string | null;
  payload?: Job[] | null;
} | null): SnapshotMeta {
  return {
    builtAt: row?.built_at ? Date.parse(row.built_at) || 0 : 0,
    sourceUpdatedAt: row?.source_updated_at || null,
    leaseUntil: row?.lease_until ? Date.parse(row.lease_until) || 0 : 0,
    payload: Array.isArray(row?.payload) ? row.payload : null,
  };
}

async function readSnapshot(sb: AdminSb, withPayload: boolean): Promise<SnapshotMeta | "off"> {
  const select = withPayload ? "payload,built_at,source_updated_at,lease_until" : "built_at,source_updated_at,lease_until";
  const { data, error } = await sb.from("board_index_snapshot").select(select).eq("id", SNAPSHOT_ID).maybeSingle();
  if (error) {
    if (missingLease(error)) {
      leaseMode = "off";
      return "off";
    }
    throw new Error(error.message);
  }
  leaseMode = "on";
  return metaFrom((data || null) as Parameters<typeof metaFrom>[0]);
}

function localSingleFlight(sb: AdminSb) {
  if (localCards && Date.now() - localCards.builtAt < 300_000) return Promise.resolve(localCards.cards);
  if (!localFlight) {
    localFlight = loadBoardIndex(sb)
      .then((cards) => {
        localCards = { builtAt: Date.now(), cards };
        return cards;
      })
      .finally(() => {
        localFlight = null;
      });
  }
  return localFlight;
}

async function buildSharedIndex(sb: AdminSb, source: string | null) {
  const owner = randomUUID();
  const result = await coordinateBoardBuild<Job[]>({
    now: Date.now(),
    sourceUpdatedAt: source,
    read: async () => {
      const meta = await readSnapshot(sb, true);
      if (meta === "off") return { payload: null, builtAt: 0, sourceUpdatedAt: null, leaseUntil: 0 };
      return meta;
    },
    claim: async () => {
      const { data, error } = await sb.rpc("board_index_claim", { owner, seconds: 45 });
      if (error) throw error;
      return data === true;
    },
    build: () => loadBoardIndex(sb),
    write: async (cards, builtAt, sourceUpdatedAt) => {
      const { error } = await sb
        .from("board_index_snapshot")
        .update({
          payload: cards,
          built_at: new Date(builtAt).toISOString(),
          source_updated_at: sourceUpdatedAt,
        })
        .eq("id", SNAPSHOT_ID)
        .eq("lease_owner", owner);
      if (error) throw new Error(error.message);
      localCards = { builtAt, cards };
    },
    release: async () => {
      await sb.rpc("board_index_release", { owner });
    },
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  });
  return result.value;
}

/** Shared public index. Early-access rows stay in it; each request removes them for non-Premium viewers. */
export async function getBoardCatalog() {
  if (!supabaseAdmin) return [] as Job[];
  const sb = supabaseAdmin;
  if (leaseMode === "off") return localSingleFlight(sb);
  try {
    const source = await latestJobUpdate(sb);
    const meta = await readSnapshot(sb, false);
    if (meta === "off") return localSingleFlight(sb);
    const now = Date.now();
    const covers = (meta.sourceUpdatedAt || "") >= (source || "");
    const age = now - meta.builtAt;
    const fresh = meta.builtAt > 0 && age < 300_000 && covers;
    const coalesced = meta.builtAt > 0 && age < 15_000 && !covers;
    if ((fresh || coalesced) && localCards?.builtAt === meta.builtAt) return localCards.cards;
    if (fresh || coalesced) {
      const full = await readSnapshot(sb, true);
      const cards = full === "off" ? [] : full.payload || [];
      localCards = { builtAt: meta.builtAt, cards };
      return cards;
    }
    return buildSharedIndex(sb, source);
  } catch (error) {
    if (missingLease(error as { code?: string; message?: string })) return localSingleFlight(sb);
    throw error;
  }
}

/** Description matches for the search route. The board response still omits the posting body. */
export async function descriptionMatchIds(query: string) {
  const ids = new Set<string>();
  if (!supabaseAdmin) return ids;
  const safe = query.replace(/[%_\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  if (safe.length < 2) return ids;
  for (let from = 0; from < 2000; from += 500) {
    const { data, error } = await supabaseAdmin
      .from("jobs")
      .select("id")
      .eq("status", "published")
      .ilike("description", `%${safe}%`)
      .range(from, from + 499);
    if (error) return ids;
    for (const row of data || []) ids.add(String(row.id || ""));
    if (!data || data.length < 500) break;
  }
  ids.delete("");
  return ids;
}

export function companiesFromBoard(jobs: Job[]): BoardCompany[] {
  const map = new Map<string, BoardCompany>();
  for (const job of jobs) {
    const name = (job.company || "").trim();
    if (!name) continue;
    const slug = ((job.companySlug || "").trim() || createCompanySlug({ name })).trim();
    const id = (job.companyId || slug || name).trim();
    if (!id || !slug) continue;
    const next = addJobToCompany(map.get(id), {
      id,
      name,
      slug,
      logoUrl: job.logo || null,
      website: job.companyWebsite || null,
      description: job.companyDescription || null,
      location: job.companyLocation || null,
      verified: job.companyVerified ?? null,
      jobTitle: job.title,
      jobCategory: job.category,
      jobLocation: job.location,
      jobRemotePolicy: job.remotePolicy,
    });
    map.set(id, next);
  }
  return [...map.values()].sort((a, b) => b.liveRoles - a.liveRoles || a.name.localeCompare(b.name));
}
