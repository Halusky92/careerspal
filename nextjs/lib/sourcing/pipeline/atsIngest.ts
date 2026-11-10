import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAshbyJobBoard, inferAshbyBoardTokenFromUrl } from "../connectors/ashby";
import { fetchLeverPostings, inferLeverBoardTokenFromUrl } from "../connectors/lever";
import { sha256Json } from "../connectors/greenhouse";
import { upsertRawJobsByHash } from "./rawIngest";

type AdminSb = SupabaseClient<any, "public", any>;

type SourceRow = {
  id: string;
  base_url: string;
  normalized_url: string;
  ats_identifier: string | null;
  display_name?: string | null;
};

async function disableBrokenSource(sb: AdminSb, sourceId: string) {
  await sb.from("sourcing_sources").update({ enabled: false }).eq("id", sourceId);
}

export async function ingestAshbyRawJobs(sb: AdminSb, args: { sourceId?: string | null }) {
  return ingestBoardList(sb, {
    sourceType: "ashby",
    sourceId: args.sourceId,
    resolveToken: (s) => (s.ats_identifier || "").trim() || inferAshbyBoardTokenFromUrl(s.normalized_url) || null,
    fetchJobs: async (token) => {
      const jobs = await fetchAshbyJobBoard(token);
      return jobs.map((job) => ({
        externalId: String(job.id),
        title: job.title || null,
        jobUrl: job.jobUrl || job.applyUrl || null,
        payload: job,
      }));
    },
  });
}

export async function ingestLeverRawJobs(sb: AdminSb, args: { sourceId?: string | null }) {
  return ingestBoardList(sb, {
    sourceType: "lever",
    sourceId: args.sourceId,
    resolveToken: (s) => (s.ats_identifier || "").trim() || inferLeverBoardTokenFromUrl(s.normalized_url) || null,
    fetchJobs: async (token) => {
      const jobs = await fetchLeverPostings(token);
      return jobs.map((job) => ({
        externalId: String(job.id),
        title: job.text || null,
        jobUrl: job.hostedUrl || job.applyUrl || null,
        payload: job,
      }));
    },
  });
}

async function ingestBoardList(
  sb: AdminSb,
  args: {
    sourceType: "ashby" | "lever";
    sourceId?: string | null;
    resolveToken: (source: SourceRow) => string | null;
    fetchJobs: (token: string) => Promise<Array<{ externalId: string; title: string | null; jobUrl: string | null; payload: unknown }>>;
  },
) {
  const sourceId = (args.sourceId || "").trim() || null;
  let query = sb
    .from("sourcing_sources")
    .select("id,base_url,normalized_url,ats_identifier,display_name")
    .eq("source_type", args.sourceType)
    .eq("validation_state", "allowed")
    .eq("enabled", true);
  if (sourceId) query = query.eq("id", sourceId);

  const { data: sources, error: srcErr } = await query.order("created_at", { ascending: false });
  if (srcErr) throw new Error("Unable to load sources.");

  const results: any[] = [];
  for (const s of (sources as SourceRow[] | null) || []) {
    const startedAt = new Date().toISOString();
    const { data: runRow } = await sb
      .from("sourcing_source_runs")
      .insert({
        source_id: s.id,
        status: "failed",
        started_at: startedAt,
        fetched_count: 0,
        new_raw_count: 0,
        new_candidates_count: 0,
        inserted_count: 0,
        skipped_count: 0,
      })
      .select("id")
      .single();
    const runId = (runRow?.id as string | undefined) || null;
    const token = args.resolveToken(s);
    if (!token) {
      if (runId) {
        await sb
          .from("sourcing_source_runs")
          .update({ status: "failed", finished_at: new Date().toISOString(), error_summary: `Missing ${args.sourceType} board token.` })
          .eq("id", runId);
      }
      results.push({ sourceId: s.id, status: "failed", error: "Missing board token." });
      continue;
    }

    try {
      const jobs = await args.fetchJobs(token);
      const rows = jobs.map((job) => ({
        source_id: s.id,
        source_run_id: runId,
        source_type: args.sourceType,
        source_url: s.normalized_url,
        external_job_id: job.externalId,
        job_url: job.jobUrl,
        title: job.title,
        raw_payload: job.payload,
        payload_hash: sha256Json(job.payload),
        fetched_at: new Date().toISOString(),
      }));

      const hashWrite =
        rows.length > 0
          ? await upsertRawJobsByHash(sb, rows)
          : { inserted: 0, updated: 0, unchanged: 0 };
      const insertedCount = hashWrite.inserted + hashWrite.updated;
      const skippedCount = hashWrite.unchanged;

      if (runId) {
        await sb
          .from("sourcing_source_runs")
          .update({
            status: "success",
            finished_at: new Date().toISOString(),
            fetched_count: jobs.length,
            new_raw_count: insertedCount,
            inserted_count: insertedCount,
            skipped_count: skippedCount,
          })
          .eq("id", runId);
      }
      results.push({
        sourceId: s.id,
        runId,
        status: "success",
        fetchedCount: jobs.length,
        insertedCount,
        skippedCount,
        externalIds: jobs.map((job) => job.externalId),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : `${args.sourceType} run failed`;
      if (/\(404\)/.test(msg) || /Missing .* board token/.test(msg)) {
        await disableBrokenSource(sb, s.id);
      }
      if (runId) {
        await sb
          .from("sourcing_source_runs")
          .update({ status: "failed", finished_at: new Date().toISOString(), error_summary: msg })
          .eq("id", runId);
      }
      results.push({ sourceId: s.id, runId, status: "failed", error: msg, fetchedCount: 0, externalIds: [] });
    }
  }

  return { ran: results.length, results };
}
