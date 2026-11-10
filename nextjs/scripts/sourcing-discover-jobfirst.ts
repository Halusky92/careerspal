/**
 * Job-first discovery. Eight niche groups, four new boards each, basic Tavily
 * searches, existing ATS review. A new qualifying board can be enabled.
 * An existing source is left unchanged. Set DISCOVERY_AUTO_APPROVE=0 to stop.
 *
 *   npx tsx scripts/sourcing-discover-jobfirst.ts --jobfirst --read-only
 *   npx tsx scripts/sourcing-discover-jobfirst.ts --jobfirst --staging-candidates
 *   npx tsx scripts/sourcing-discover-jobfirst.ts --jobfirst --production-candidates
 *
 * --staging-candidates writes only to the staging project and refuses production.
 * --production-candidates is the one-shot production entry. It allows at most 8 searches
 * and 4 new sources, inserts them disabled, and does not publish jobs.
 * --production-daily is the daily entry. It rotates all 8 groups, allows at most 8
 * searches, and stops when the monthly ledger reaches 250. It is not scheduled yet.
 */
import fs from "fs";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  assertProductionDatabaseUrl,
  assertStagingDatabaseUrl,
  DAILY_SEARCH_CAP,
  DISCOVERY_DOMAINS,
  DISCOVERY_GROUPS,
  rotateDiscoveryGroups,
  runJobFirstDiscovery,
  seedBoardKeys,
  type PhraseState,
} from "../lib/sourcing/discovery/jobfirst";
import { reviewDiscoveryLead, toPendingSourceRow, type DiscoveryFetcher, type DiscoveryReview } from "../lib/sourcing/discovery/review";
import { autoApprovalForNewSource, discoveryAutoApproveEnabled } from "../lib/sourcing/discovery/autoApprove";

const ATS_GAP_MS = 700;
const TIMEOUT_MS = 25_000;
const readOnly = process.argv.includes("--read-only");
const staging = process.argv.includes("--staging-candidates");
const production = process.argv.includes("--production-candidates");
const productionDaily = process.argv.includes("--production-daily");

if (!process.argv.includes("--jobfirst") || [readOnly, staging, production, productionDaily].filter(Boolean).length !== 1) {
  console.error("REFUSED. Pass --jobfirst and exactly one of --read-only, --staging-candidates, --production-candidates, or --production-daily.");
  process.exit(2);
}

function loadEnv(file: string) {
  const out: Record<string, string> = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!raw || raw.trim().startsWith("#") || !raw.includes("=")) continue;
    const index = raw.indexOf("=");
    out[raw.slice(0, index).trim()] = raw.slice(index + 1).trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tavilyKey() {
  return loadEnv(path.join(process.cwd(), ".env.local")).TAVILY_API_KEY || process.env.TAVILY_API_KEY || "";
}

async function searchTavily(key: string, query: string) {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      topic: "general",
      max_results: 8,
      include_domains: DISCOVERY_DOMAINS,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status === 401 || response.status === 402 || response.status === 429 || response.status === 432) {
    throw new Error(`Tavily stopped with HTTP ${response.status}`);
  }
  if (!response.ok) throw new Error(`Tavily HTTP ${response.status}`);
  const payload = (await response.json()) as { results?: Array<{ url?: string; title?: string }> };
  console.log(`SEARCH ${response.status} results=${payload.results?.length || 0}`);
  return (payload.results || []).map((row) => ({ url: row.url || "", title: row.title || "" }));
}

function atsFetcher(): DiscoveryFetcher {
  let stop = false;
  return async (url) => {
    if (stop) return { status: 429, body: "" };
    console.log(`ATS ${new URL(url).host}${new URL(url).pathname}`);
    await sleep(ATS_GAP_MS);
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "CareersPalSourcing/1.0" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (response.status === 429 || response.status === 503) {
        await response.body?.cancel();
        stop = true;
        return { status: response.status, body: "" };
      }
      const reader = response.body?.getReader();
      if (!reader) return { status: response.status, body: await response.text() };
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      while (true) {
        const step = await reader.read();
        if (step.done) break;
        bytes += step.value.byteLength;
        if (bytes > 4_000_000) {
          await reader.cancel();
          console.log("ATS body too large");
          return { status: 0, body: "" };
        }
        chunks.push(step.value);
      }
      return { status: response.status, body: new TextDecoder().decode(Buffer.concat(chunks)) };
    } catch {
      return { status: 0, body: "" };
    }
  };
}

async function greenhouseName(token: string) {
  const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}`, {
    headers: { Accept: "application/json", "User-Agent": "CareersPalSourcing/1.0" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    await response.body?.cancel();
    return "";
  }
  const payload = (await response.json()) as { name?: string };
  return (payload.name || "").trim();
}

function stagingClient() {
  const env = loadEnv(path.join(process.cwd(), ".env.staging.local"));
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "";
  assertStagingDatabaseUrl(url);
  const key = env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!key) throw new Error("REFUSED missing staging service role");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function productionClient() {
  const file = loadEnv(path.join(process.cwd(), ".env.local"));
  const url = file.SUPABASE_URL || file.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  assertProductionDatabaseUrl(url);
  const key = file.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!key) throw new Error("REFUSED missing production service role");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function main() {
  const key = tavilyKey();
  if (!key) {
    console.error("MISSING TAVILY_API_KEY in nextjs/.env.local");
    process.exit(2);
  }
  const sb = staging ? stagingClient() : production || productionDaily ? productionClient() : null;
  const known = seedBoardKeys();
  const phrases: Record<string, PhraseState | undefined> = {};
  if (sb) {
    const { data: boards, error: boardError } = await sb.from("sourcing_discovery_boards").select("provider,identifier");
    if (boardError) throw new Error(boardError.message);
    for (const row of boards || []) known.add(`${row.provider}:${String(row.identifier).toLowerCase()}`);
    const { data: sources, error: sourceError } = await sb.from("sourcing_sources").select("source_type,ats_identifier");
    if (sourceError) throw new Error(sourceError.message);
    for (const row of sources || []) {
      if (row.ats_identifier) known.add(`${row.source_type}:${String(row.ats_identifier).toLowerCase()}`);
    }
    const { data: saved, error: phraseError } = await sb.from("sourcing_discovery_phrases").select("*");
    if (phraseError) throw new Error(phraseError.message);
    for (const row of saved || []) {
      phrases[row.group_id] = {
        variantIndex: row.variant_index || 0,
        zeroNewStreak: row.zero_new_streak || 0,
        cooledUntil: row.cooled_until,
        updatedAt: row.updated_at,
      };
    }
  }
  const month = new Date().toISOString().slice(0, 7);
  let monthCount = 0;
  if (sb) {
    const { data, error } = await sb.from("sourcing_discovery_usage").select("search_count").eq("month_key", month).maybeSingle();
    if (error) throw new Error(error.message);
    monthCount = data?.search_count || 0;
  }
  const fetcher = atsFetcher();
  const reviews: DiscoveryReview[] = [];
  const started = Date.now();
  const now = new Date();
  const result = await runJobFirstDiscovery({
    now,
    monthCount,
    phrases,
    known,
    ...(production ? { maxSearches: 8, maxBoards: 4 } : {}),
    ...(productionDaily
      ? { maxSearches: DAILY_SEARCH_CAP, groups: rotateDiscoveryGroups(DISCOVERY_GROUPS, now), oncePerDay: true }
      : {}),
    claim: sb
      ? async () => {
          const { data, error } = await sb.rpc("claim_discovery_search", { p_month: month, p_cap: 250 });
          if (error) throw new Error(error.message);
          if (data == null || data === "") return false;
          return Number.isFinite(Number(data));
        }
      : undefined,
    search: (query) => searchTavily(key, query),
    review: async (board) => {
      const review = await reviewDiscoveryLead(
        { companyName: board.identifier, website: board.boardUrl, atsUrl: board.boardUrl },
        fetcher,
        [],
        { greenhouseUseContent: true },
      );
      reviews.push(review);
      if (sb) await rememberBoard(sb, review, board.boardUrl);
      return review;
    },
    onGroup: async (groupId, update, info) => {
      console.log(`GROUP ${groupId} phrase=${info.phrase || "-"} boards=${info.boards} qualifying=${info.qualifying} skipped=${info.skipped || "-"}`);
      if (!sb || !update) return;
      const { error } = await sb.from("sourcing_discovery_phrases").upsert({
        group_id: groupId,
        variant_index: update.variantIndex,
        zero_new_streak: update.zeroNewStreak,
        cooled_until: update.cooledUntil,
        last_new_boards: info.boards,
        last_qualifying: info.qualifying,
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
    },
  });
  let savedSources = 0;
  for (const review of result.pending) {
    const name = review.atsProvider === "greenhouse" && review.atsIdentifier ? await greenhouseName(review.atsIdentifier) : "";
    const companyName = name || review.companyName;
    console.log(`PENDING ${companyName} ${review.atsProvider} qualifying=${review.qualifyingJobCount}`);
    for (const job of review.qualifyingJobs) {
      console.log(`JOB ${companyName} | ${job.title} | ${job.salary || "-"} | ${job.location || "-"} | ${job.remote || "-"} | ${job.score} | ${job.applyUrl}`);
    }
    if (sb) {
      const companyId = name ? await ensureCompany(sb, name) : null;
      const wrote = await ensureSource(sb, { ...review, companyName }, companyId, (production || productionDaily) && discoveryAutoApproveEnabled());
      if (wrote) savedSources += 1;
    }
  }
  if (sb) {
    const qualifying = result.pending.reduce((sum, review) => sum + review.qualifyingJobCount, 0);
    const { data } = await sb.from("sourcing_discovery_usage").select("qualifying_jobs").eq("month_key", month).maybeSingle();
    await sb
      .from("sourcing_discovery_usage")
      .update({ qualifying_jobs: (data?.qualifying_jobs || 0) + qualifying, updated_at: new Date().toISOString() })
      .eq("month_key", month);
  }
  const seconds = Math.round((Date.now() - started) / 1000);
  const mode = staging ? "staging-candidates" : production ? "production-candidates" : productionDaily ? "production-daily" : "read-only";
  console.log(
    `RESULT mode=${mode} searches=${result.searches} groups=${result.groups.length} pending_sources=${result.pending.length} saved_sources=${savedSources} qualifying_jobs=${result.pending.reduce((sum, review) => sum + review.qualifyingJobCount, 0)} reviewed=${reviews.length} seconds=${seconds} published=0 enabled=0`,
  );
}

async function rememberBoard(sb: SupabaseClient, review: DiscoveryReview, foundUrl: string) {
  if (!review.atsProvider || !review.atsIdentifier) return;
  const { error } = await sb.from("sourcing_discovery_boards").upsert({
    provider: review.atsProvider,
    identifier: review.atsIdentifier.toLowerCase(),
    decision: review.decision,
    qualifying_jobs: review.qualifyingJobCount,
    company_name: review.companyName,
    found_url: foundUrl,
  });
  if (error) throw new Error(error.message);
}

async function ensureCompany(sb: SupabaseClient, name: string) {
  const { data: existing, error: readError } = await sb.from("companies").select("id,verified").eq("name", name).maybeSingle();
  if (readError) throw new Error(readError.message);
  if (existing?.id) return existing.id as string;
  const { data, error } = await sb.from("companies").insert({ name, verified: false }).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

async function ensureSource(sb: SupabaseClient, review: DiscoveryReview, companyId: string | null, autoApprove: boolean) {
  const row = toPendingSourceRow(review);
  if (!row) return false;
  const { data: existing, error: readError } = await sb
    .from("sourcing_sources")
    .select("id,enabled")
    .eq("source_type", row.source_type)
    .eq("ats_identifier", row.ats_identifier)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (existing?.id) return false;
  const approval = autoApprovalForNewSource({
    alreadySaved: false,
    autoApproveEnabled: autoApprove,
    decision: review.decision,
    qualifyingJobs: review.qualifyingJobs,
  });
  const approvedAt = new Date().toISOString();
  const { error } = await sb.from("sourcing_sources").insert(
    approval.approve
      ? {
          ...row,
          company_id: companyId,
          enabled: true,
          validation_state: "allowed",
          approval_decision: "approved_as_official_ats",
          approved_at: approvedAt,
          approval_notes: `auto: ${approval.title}`,
        }
      : { ...row, company_id: companyId, enabled: false },
  );
  if (error) throw new Error(error.message);
  if (!approval.approve) return true;
  const { error: auditError } = await sb.from("audit_logs").insert({
    actor_id: null,
    action: "sourcing_discovery_auto_approve",
    metadata: {
      provider: row.source_type,
      identifier: row.ats_identifier,
      title: approval.title,
      applyUrl: approval.applyUrl,
      salary: approval.salary,
      approvedAt,
    },
  });
  if (auditError) throw new Error(auditError.message);
  return true;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "job-first discovery failed");
  process.exit(1);
});
