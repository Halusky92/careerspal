import { supabaseAdmin } from "../supabaseAdmin";
import {
  autoPublishEligibleCandidates,
  evaluateCandidates,
  ingestGreenhouseRawJobs,
  normalizeGreenhouseRawJobsToCandidates,
} from "./pipeline/greenhouseSteps";
import { ingestAshbyRawJobs, ingestLeverRawJobs } from "./pipeline/atsIngest";
import { syncPublishedSourcedJobs } from "./pipeline/syncPublishedJobs";
import { closeJobsMissingFromBoard } from "./pipeline/closeMissingJobs";
import { enrichCandidatesSalaryBulk } from "./pipeline/salaryEnrichment";
import { backfillMissingCompanyLogos } from "./backfillCompanyLogos";
import {
  chooseSalarySource,
  type SliceMode,
  SALARY_DAILY_CAP,
  sliceBudgetMs,
  sliceExpired,
  sourcesDueForRefresh,
} from "./pipeline/slice";

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
  mode?: SliceMode;
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
    .select("source_id,started_at,status")
    .in("source_id", ids)
    .order("started_at", { ascending: false })
    .limit(400);

  const last = new Map<string, { startedAt: string; status: string | null }>();
  for (const row of (runs as { source_id: string; started_at: string; status: string | null }[] | null) || []) {
    if (!last.has(row.source_id)) last.set(row.source_id, { startedAt: row.started_at, status: row.status });
  }

  const dueIds = sourcesDueForRefresh(
    eligible.map((source) => ({
      id: source.id,
      startedAt: last.get(source.id)?.startedAt || null,
      status: last.get(source.id)?.status || null,
    })),
    new Date(),
    limit,
  );
  return dueIds.map((id) => eligible.find((source) => source.id === id)).filter((source): source is SourceRow => Boolean(source));
}

async function pickSalarySource(): Promise<SourceRow | null> {
  if (!supabaseAdmin) return null;
  const { data: sources, error } = await supabaseAdmin
    .from("sourcing_sources")
    .select("id,source_type,validation_state,enabled")
    .in("source_type", ["greenhouse", "ashby", "lever"])
    .eq("validation_state", "allowed")
    .eq("enabled", true);
  if (error) throw new Error("Unable to load sources.");
  const eligible = ((sources as SourceRow[] | null) || []).filter((source) => source.enabled && source.validation_state === "allowed");
  if (eligible.length === 0) return null;
  const { data: candidates } = await supabaseAdmin
    .from("sourcing_sourced_job_candidates")
    .select("source_id,provenance")
    .is("published_job_id", null)
    .eq("salary_present", false)
    .eq("publish_status", "skipped_not_eligible")
    .order("created_at", { ascending: true })
    .limit(500);
  const sourceId = chooseSalarySource(
    ((candidates as { source_id: string; provenance: unknown }[] | null) || []).map((row) => ({
      sourceId: row.source_id,
      provenance: row.provenance,
    })),
    eligible.map((source) => source.id),
    Date.now(),
  );
  return eligible.find((source) => source.id === sourceId) || null;
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
  const mode: SliceMode = args.mode || (typeof args.maxSources === "number" ? "refresh" : "full");
  const limitRaw = Math.min(500, Math.max(1, Number(args.limitRaw) || (mode === "full" ? 300 : 25)));
  const limitCandidates = Math.min(300, Math.max(1, Number(args.limitCandidates) || (mode === "full" ? 200 : 40)));
  const includeSalary = mode === "refresh" ? false : args.includeSalaryEnrichment !== false;
  const includeLogos = mode === "full" && args.includeLogoBackfill !== false;
  const deadline = Date.now() + (args.timeBudgetMs && args.timeBudgetMs > 0 ? args.timeBudgetMs : sliceBudgetMs(mode));
  const trigger = args.trigger || (args.actorId ? "manual" : "cron");

  let eligibleSources: SourceRow[] = [];
  if (mode === "salary" && !sourceId) {
    const salarySource = await pickSalarySource();
    eligibleSources = salarySource ? [salarySource] : [];
  } else if (sourceId) {
    const { data: sources, error: srcErr } = await supabaseAdmin
      .from("sourcing_sources")
      .select("id,source_type,validation_state,enabled")
      .eq("id", sourceId);
    if (srcErr) throw new Error("Unable to load sources.");
    eligibleSources = ((sources as SourceRow[] | null) || []).filter((s) => s.enabled && s.validation_state === "allowed");
  } else if (mode === "refresh" || typeof args.maxSources === "number") {
    eligibleSources = await pickStaleEnabledSources(args.maxSources || 1);
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
    mode,
    done: false,
    sources_processed: eligibleSources.length,
    timed_out: false,
    failed_step: null as string | null,
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
      reasons: {} as Record<string, number>,
    },
    per_source: [] as any[],
  };
  const noteStop = (step: string) => {
    pipeSummary.timed_out = true;
    if (!pipeSummary.failed_step) pipeSummary.failed_step = step;
  };

  for (const s of mode === "salary" ? [] : eligibleSources) {
    if (sliceExpired(deadline)) {
      noteStop("fetch");
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

  (pipeSummary as any).close_from_board = { closed: 0, reopened: 0, missed: 0, seen: 0, breakers: [] as string[] };
  for (const result of pipeSummary.ingestion.results) {
    try {
      const closed = await closeJobsMissingFromBoard(supabaseAdmin, result);
      (pipeSummary as any).close_from_board.closed += Number(closed.closed || 0);
      (pipeSummary as any).close_from_board.reopened += Number(closed.reopened || 0);
      (pipeSummary as any).close_from_board.missed += Number(closed.missed || 0);
      (pipeSummary as any).close_from_board.seen += Number(closed.seen || 0);
      if (closed.breaker) (pipeSummary as any).close_from_board.breakers.push(closed.breaker);
    } catch {
      (pipeSummary as any).close_from_board.breakers.push("close_error");
    }
  }

  const perSourceRawLimit = mode === "full" && !sourceId ? Math.max(40, Math.ceil(limitRaw / Math.max(1, eligibleSources.length))) : limitRaw;
  const perSourceCandidateLimit = mode === "full" && !sourceId ? Math.max(40, Math.ceil(limitCandidates / Math.max(1, eligibleSources.length))) : limitCandidates;

  const publishedJobIdsAll: string[] = [];
  const duplicateJobIdsAll: string[] = [];

  for (const s of eligibleSources) {
    if (sliceExpired(deadline)) {
      noteStop("normalize");
      break;
    }
    const sid = s.id;

    if (mode !== "salary") {
      const norm = await normalizeGreenhouseRawJobsToCandidates(supabaseAdmin, {
        sourceId: sid,
        limit: perSourceRawLimit,
        scanLimit: mode === "full" ? perSourceRawLimit : 400,
        deadline,
      });
      pipeSummary.normalization.processed += Number(norm.processed || 0) || 0;
      pipeSummary.normalization.inserted += Number(norm.inserted || 0) || 0;
      pipeSummary.normalization.updated += Number(norm.updated || 0) || 0;
      pipeSummary.normalization.skipped += Number(norm.skipped || 0) || 0;
      pipeSummary.normalization.errors += Array.isArray(norm.errors) ? norm.errors.length : 0;
      if (norm.stopped) {
        noteStop("normalize");
        const runId = pipeSummary.ingestion.results.find((result: { sourceId?: string; runId?: string }) => result.sourceId === sid)?.runId;
        if (runId) {
          await supabaseAdmin
            .from("sourcing_source_runs")
            .update({ status: "partial", error_summary: "Stopped before the time limit. The next slice resumes this board." })
            .eq("id", runId);
        }
      }
    }

    if (mode !== "salary" && !sliceExpired(deadline)) {
      try {
        const synced = await syncPublishedSourcedJobs(supabaseAdmin, { sourceId: sid, limit: 80 });
        (pipeSummary as any).freshness = {
          processed: Number((pipeSummary as any).freshness?.processed || 0) + Number(synced.processed || 0),
          updated: Number((pipeSummary as any).freshness?.updated || 0) + Number(synced.updated || 0),
          unchanged: Number((pipeSummary as any).freshness?.unchanged || 0) + Number(synced.unchanged || 0),
          held: Number((pipeSummary as any).freshness?.held || 0) + Number(synced.held || 0),
        };
      } catch {
        (pipeSummary as any).freshness = { ...(pipeSummary as any).freshness, error: true };
      }
    }

    if (includeSalary && !sliceExpired(deadline)) {
      const sal = await enrichCandidatesSalaryBulk(supabaseAdmin, {
        sourceId: sid,
        limit: SALARY_DAILY_CAP,
        concurrency: 1,
        cooldownHours: 24,
        scanLimit: 80,
        deadline,
      });
      pipeSummary.salary_enrichment.scanned += Number(sal.scanned || 0) || 0;
      pipeSummary.salary_enrichment.attempted += Number(sal.attempted || 0) || 0;
      pipeSummary.salary_enrichment.updated += Number(sal.updated || 0) || 0;
      pipeSummary.salary_enrichment.reopened += Number(sal.reopened || 0) || 0;
      pipeSummary.salary_enrichment.not_found += Number(sal.not_found || 0) || 0;
      pipeSummary.salary_enrichment.failed += Number(sal.failed || 0) || 0;
      pipeSummary.salary_enrichment.skipped_recent += Number(sal.skipped_recent || 0) || 0;
      if (sal.stopped) noteStop("salary");
    }

    if (sliceExpired(deadline)) {
      noteStop(includeSalary ? "salary" : "evaluate");
      continue;
    }
    const ev = await evaluateCandidates(supabaseAdmin, {
      sourceId: sid,
      limit: perSourceCandidateLimit,
      publishStatuses: ["not_published"],
    });
    pipeSummary.evaluation.processed += Number(ev.processed || 0) || 0;
    pipeSummary.evaluation.evaluated += Number(ev.evaluated || 0) || 0;
    pipeSummary.evaluation.errors += Array.isArray(ev.errors) ? ev.errors.length : 0;

    const pub = await autoPublishEligibleCandidates(supabaseAdmin, {
      actorId: args.actorId,
      sourceId: sid,
      limit: mode === "full" ? 80 : 20,
      publishStatuses: ["not_published"],
      deadline,
    });
    pipeSummary.auto_publish.processed += Number(pub.processed || 0) || 0;
    pipeSummary.auto_publish.published += Number(pub.published || 0) || 0;
    pipeSummary.auto_publish.failed += Number(pub.failed || 0) || 0;
    pipeSummary.auto_publish.minScore = typeof pub.minScore === "number" ? pub.minScore : pipeSummary.auto_publish.minScore;

    const pubResults = Array.isArray((pub as any).results) ? ((pub as any).results as any[]) : [];
    pipeSummary.auto_publish.skipped_duplicates += pubResults.filter((r) => r?.status === "skipped_duplicate").length;
    pipeSummary.auto_publish.skipped_not_eligible += pubResults.filter((r) => r?.status === "skipped").length;
    if (pubResults.some((r) => r?.status === "stopped")) noteStop("publish");
    for (const [key, count] of Object.entries((pub.skipReasons || {}) as Record<string, number>)) {
      pipeSummary.auto_publish.reasons[key] = (pipeSummary.auto_publish.reasons[key] || 0) + count;
    }

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

  if (mode === "full") {
    pipeSummary.done = !pipeSummary.timed_out;
  } else if (eligibleSources.length === 0 || pipeSummary.timed_out) {
    pipeSummary.done = eligibleSources.length === 0;
  } else if (mode === "salary") {
    pipeSummary.done = (await pickSalarySource()) == null;
  } else {
    pipeSummary.done = (await pickStaleEnabledSources(1)).length === 0;
  }

  if (includeLogos && !sliceExpired(deadline)) {
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
