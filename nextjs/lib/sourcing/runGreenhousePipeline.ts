import { supabaseAdmin } from "../supabaseAdmin";
import {
  autoPublishEligibleCandidates,
  evaluateCandidates,
  ingestGreenhouseRawJobs,
  normalizeGreenhouseRawJobsToCandidates,
} from "./pipeline/greenhouseSteps";
import { ingestAshbyRawJobs, ingestLeverRawJobs } from "./pipeline/atsIngest";
import { enrichCandidatesSalaryBulk } from "./pipeline/salaryEnrichment";
import { ensureSeedSourcingBoards } from "./seedBoards";
import { backfillMissingCompanyLogos } from "./backfillCompanyLogos";

export type SourceRow = {
  id: string;
  source_type: string;
  validation_state: string;
  enabled: boolean;
};

export type PipelineRunOptions = {
  sourceId?: string | null;
  limitRaw?: number;
  limitCandidates?: number;
  actorId: string | null;
  maxSources?: number;
  includeSalaryEnrichment?: boolean;
  includeLogoBackfill?: boolean;
  timeBudgetMs?: number;
  trigger?: "cron" | "manual" | "github";
};

async function pickStaleEnabledSources(limit: number): Promise<SourceRow[]> {
  if (!supabaseAdmin) return [];
  const { data: sources, error } = await supabaseAdmin
    .from("sourcing_sources")
    .select("id,source_type,validation_state,enabled")
    .in("source_type", ["greenhouse", "ashby", "lever"])
    .eq("validation_state", "allowed")
    .eq("enabled", true)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Unable to load sources.");
  const eligible = ((sources as SourceRow[] | null) || []).filter((s) => s.enabled && s.validation_state === "allowed");
  if (eligible.length === 0) return [];

  const ids = eligible.map((s) => s.id);
  const { data: runs } = await supabaseAdmin
    .from("sourcing_source_runs")
    .select("source_id,started_at")
    .in("source_id", ids)
    .order("started_at", { ascending: false })
    .limit(400);

  const last = new Map<string, string>();
  for (const row of (runs as { source_id: string; started_at: string }[] | null) || []) {
    if (!last.has(row.source_id)) last.set(row.source_id, row.started_at);
  }

  const startOfUtcDay = new Date();
  startOfUtcDay.setUTCHours(0, 0, 0, 0);
  const dayIso = startOfUtcDay.toISOString();

  const pending = eligible
    .filter((s) => {
      const at = last.get(s.id);
      return !at || at < dayIso;
    })
    .sort((a, b) => (last.get(a.id) || "").localeCompare(last.get(b.id) || ""));

  const pool = pending.length > 0 ? pending : eligible.sort((a, b) => (last.get(a.id) || "").localeCompare(last.get(b.id) || ""));
  return pool.slice(0, Math.max(1, limit));
}

export async function writeSourcingCronHealth(payload: Record<string, unknown>) {
  if (!supabaseAdmin) return;
  await supabaseAdmin.from("audit_logs").insert({
    actor_id: null,
    action: "sourcing_cron_health",
    metadata: payload,
  });
}

export async function runPipelineGreenhouse(args: PipelineRunOptions) {
  if (!supabaseAdmin) throw new Error("Supabase not configured.");

  const sourceId = (args.sourceId || "").trim() || null;
  const limitRaw = Math.min(500, Math.max(1, Number(args.limitRaw) || 300));
  const limitCandidates = Math.min(300, Math.max(1, Number(args.limitCandidates) || 200));
  const includeSalary = args.includeSalaryEnrichment !== false;
  const includeLogos = args.includeLogoBackfill !== false;
  const deadline = args.timeBudgetMs && args.timeBudgetMs > 0 ? Date.now() + args.timeBudgetMs : null;
  const trigger = args.trigger || (args.actorId ? "manual" : "cron");

  if (!sourceId) {
    await ensureSeedSourcingBoards(supabaseAdmin);
  }

  let eligibleSources: SourceRow[] = [];
  if (sourceId) {
    const { data: sources, error: srcErr } = await supabaseAdmin
      .from("sourcing_sources")
      .select("id,source_type,validation_state,enabled")
      .eq("id", sourceId);
    if (srcErr) throw new Error("Unable to load sources.");
    eligibleSources = ((sources as SourceRow[] | null) || []).filter((s) => s.enabled && s.validation_state === "allowed");
  } else if (typeof args.maxSources === "number") {
    eligibleSources = await pickStaleEnabledSources(args.maxSources);
  } else {
    const { data: sources, error: srcErr } = await supabaseAdmin
      .from("sourcing_sources")
      .select("id,source_type,validation_state,enabled")
      .in("source_type", ["greenhouse", "ashby", "lever"])
      .eq("validation_state", "allowed")
      .eq("enabled", true)
      .order("created_at", { ascending: false });
    if (srcErr) throw new Error("Unable to load sources.");
    eligibleSources = ((sources as SourceRow[] | null) || []).filter((s) => s.enabled && s.validation_state === "allowed");
  }

  const pipeSummary = {
    trigger,
    sources_processed: eligibleSources.length,
    timed_out: false,
    runs_created: 0,
    raw_fetched: 0,
    raw_inserted: 0,
    raw_skipped: 0,
    ingestion: { ran: 0, results: [] as any[] },
    normalization: { processed: 0, inserted: 0, updated: 0, skipped: 0, errors: 0 },
    evaluation: { processed: 0, evaluated: 0, errors: 0 },
    salary_enrichment: { scanned: 0, attempted: 0, updated: 0, reopened: 0, not_found: 0, failed: 0, skipped_recent: 0 },
    auto_publish: {
      processed: 0,
      published: 0,
      skipped_total: 0,
      skipped_duplicates: 0,
      skipped_not_eligible: 0,
      failed: 0,
      minScore: null as number | null,
    },
    per_source: [] as any[],
  };

  for (const s of eligibleSources) {
    if (deadline && Date.now() >= deadline) {
      pipeSummary.timed_out = true;
      break;
    }
    const type = (s.source_type || "").toLowerCase();
    const out =
      type === "ashby"
        ? await ingestAshbyRawJobs(supabaseAdmin, { sourceId: s.id })
        : type === "lever"
          ? await ingestLeverRawJobs(supabaseAdmin, { sourceId: s.id })
          : await ingestGreenhouseRawJobs(supabaseAdmin, { sourceId: s.id });
    pipeSummary.ingestion.ran += Number(out.ran || 0) || 0;
    pipeSummary.ingestion.results.push(...(out.results || []));
  }

  pipeSummary.runs_created = pipeSummary.ingestion.results.filter((r: any) => Boolean(r?.runId)).length;
  pipeSummary.raw_fetched = pipeSummary.ingestion.results.reduce((acc: number, r: any) => acc + (Number(r?.fetchedCount) || 0), 0);
  pipeSummary.raw_inserted = pipeSummary.ingestion.results.reduce((acc: number, r: any) => acc + (Number(r?.insertedCount) || 0), 0);
  pipeSummary.raw_skipped = pipeSummary.ingestion.results.reduce((acc: number, r: any) => acc + (Number(r?.skippedCount) || 0), 0);

  const perSourceRawLimit = sourceId ? limitRaw : Math.max(40, Math.ceil(limitRaw / Math.max(1, eligibleSources.length)));
  const perSourceCandidateLimit = sourceId ? limitCandidates : Math.max(40, Math.ceil(limitCandidates / Math.max(1, eligibleSources.length)));

  const publishedJobIdsAll: string[] = [];
  const duplicateJobIdsAll: string[] = [];

  for (const s of eligibleSources) {
    if (deadline && Date.now() >= deadline) {
      pipeSummary.timed_out = true;
      break;
    }
    const sid = s.id;

    const norm = await normalizeGreenhouseRawJobsToCandidates(supabaseAdmin, { sourceId: sid, limit: perSourceRawLimit });
    pipeSummary.normalization.processed += Number(norm.processed || 0) || 0;
    pipeSummary.normalization.inserted += Number(norm.inserted || 0) || 0;
    pipeSummary.normalization.updated += Number(norm.updated || 0) || 0;
    pipeSummary.normalization.skipped += Number(norm.skipped || 0) || 0;
    pipeSummary.normalization.errors += Array.isArray(norm.errors) ? norm.errors.length : 0;

    const ev = await evaluateCandidates(supabaseAdmin, { sourceId: sid, limit: perSourceCandidateLimit });
    pipeSummary.evaluation.processed += Number(ev.processed || 0) || 0;
    pipeSummary.evaluation.evaluated += Number(ev.evaluated || 0) || 0;
    pipeSummary.evaluation.errors += Array.isArray(ev.errors) ? ev.errors.length : 0;

    if (includeSalary && (!deadline || Date.now() < deadline)) {
      const sal = await enrichCandidatesSalaryBulk(supabaseAdmin, {
        sourceId: sid,
        limit: 8,
        concurrency: 2,
        cooldownHours: 24,
        scanLimit: 80,
      });
      pipeSummary.salary_enrichment.scanned += Number(sal.scanned || 0) || 0;
      pipeSummary.salary_enrichment.attempted += Number(sal.attempted || 0) || 0;
      pipeSummary.salary_enrichment.updated += Number(sal.updated || 0) || 0;
      pipeSummary.salary_enrichment.reopened += Number(sal.reopened || 0) || 0;
      pipeSummary.salary_enrichment.not_found += Number(sal.not_found || 0) || 0;
      pipeSummary.salary_enrichment.failed += Number(sal.failed || 0) || 0;
      pipeSummary.salary_enrichment.skipped_recent += Number(sal.skipped_recent || 0) || 0;
    }

    const pub = await autoPublishEligibleCandidates(supabaseAdmin, { actorId: args.actorId, sourceId: sid, limit: 80 });
    pipeSummary.auto_publish.processed += Number(pub.processed || 0) || 0;
    pipeSummary.auto_publish.published += Number(pub.published || 0) || 0;
    pipeSummary.auto_publish.failed += Number(pub.failed || 0) || 0;
    pipeSummary.auto_publish.minScore = typeof pub.minScore === "number" ? pub.minScore : pipeSummary.auto_publish.minScore;

    const pubResults = Array.isArray((pub as any).results) ? ((pub as any).results as any[]) : [];
    pipeSummary.auto_publish.skipped_duplicates += pubResults.filter((r) => r?.status === "skipped_duplicate").length;
    pipeSummary.auto_publish.skipped_not_eligible += pubResults.filter((r) => r?.status === "skipped").length;

    publishedJobIdsAll.push(
      ...pubResults
        .filter((r) => r?.status === "published" && typeof r?.jobId === "string")
        .map((r) => String(r.jobId))
        .filter(Boolean),
    );
    duplicateJobIdsAll.push(
      ...pubResults
        .filter((r) => r?.status === "skipped_duplicate" && typeof r?.jobId === "string")
        .map((r) => String(r.jobId))
        .filter(Boolean),
    );

    pipeSummary.per_source.push({
      sourceId: sid,
      auto_publish: {
        processed: Number((pub as any).processed || 0) || 0,
        published: Number((pub as any).published || 0) || 0,
        failed: Number((pub as any).failed || 0) || 0,
      },
    });
  }

  pipeSummary.auto_publish.skipped_total = pipeSummary.auto_publish.skipped_duplicates + pipeSummary.auto_publish.skipped_not_eligible;
  (pipeSummary.auto_publish as any).published_job_ids = Array.from(new Set(publishedJobIdsAll)).slice(0, 60);
  (pipeSummary.auto_publish as any).duplicate_job_ids = Array.from(new Set(duplicateJobIdsAll)).slice(0, 60);

  if (includeLogos && (!deadline || Date.now() < deadline)) {
    try {
      (pipeSummary as any).logo_backfill = await backfillMissingCompanyLogos(supabaseAdmin, 40);
    } catch {
      (pipeSummary as any).logo_backfill = { error: true };
    }
  }

  await supabaseAdmin.from("audit_logs").insert({
    actor_id: args.actorId,
    action: "sourcing_greenhouse_pipeline_run",
    metadata: pipeSummary,
  });

  return pipeSummary;
}
