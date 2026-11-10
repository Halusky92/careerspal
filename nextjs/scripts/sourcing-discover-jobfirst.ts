/**
 * Job-first discovery. Eight niche groups, four new boards each, basic Tavily
 * searches, existing ATS review. New sources stay disabled.
 *
 *   npx tsx scripts/sourcing-discover-jobfirst.ts --jobfirst --read-only
 *   npx tsx scripts/sourcing-discover-jobfirst.ts --jobfirst --staging-candidates
 *
 * --staging-candidates writes only to the staging project. It does not publish jobs.
 * The 3x weekly cadence is DISCOVERY_CADENCE and is not registered as a cron.
 */
import fs from "fs";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  assertStagingDatabaseUrl,
  DISCOVERY_DOMAINS,
  DISCOVERY_GROUPS,
  runJobFirstDiscovery,
  seedBoardKeys,
  type PhraseState,
} from "../lib/sourcing/discovery/jobfirst";
import { reviewDiscoveryLead, toPendingSourceRow, type DiscoveryFetcher, type DiscoveryReview } from "../lib/sourcing/discovery/review";

const ATS_GAP_MS = 700;
const TIMEOUT_MS = 25_000;
const readOnly = process.argv.includes("--read-only");
const staging = process.argv.includes("--staging-candidates");

if (!process.argv.includes("--jobfirst") || (!readOnly && !staging) || (readOnly && staging)) {
  console.error("REFUSED. Pass --jobfirst and exactly one of --read-only or --staging-candidates.");
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

async function main() {
  const key = tavilyKey();
  if (!key) {
    console.error("MISSING TAVILY_API_KEY in nextjs/.env.local");
    process.exit(2);
  }
  const sb = staging ? stagingClient() : null;
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
  const result = await runJobFirstDiscovery({
    now: new Date(),
    monthCount,
    phrases,
    known,
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
      const wrote = await ensureDisabledSource(sb, { ...review, companyName }, companyId);
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
  console.log(
    `RESULT mode=${staging ? "staging-candidates" : "read-only"} searches=${result.searches} groups=${result.groups.length} pending_sources=${result.pending.length} saved_sources=${savedSources} qualifying_jobs=${result.pending.reduce((sum, review) => sum + review.qualifyingJobCount, 0)} reviewed=${reviews.length} seconds=${seconds} published=0 enabled=0`,
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

async function ensureDisabledSource(sb: SupabaseClient, review: DiscoveryReview, companyId: string | null) {
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
  const { error } = await sb.from("sourcing_sources").insert({ ...row, company_id: companyId, enabled: false });
  if (error) throw new Error(error.message);
  return true;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "job-first discovery failed");
  process.exit(1);
});
