import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../../../lib/supabaseServerAuth";
import { getSourcingCronSecret } from "../../../../../../lib/sourcing/config";
import {
  autoPublishEligibleCandidates,
  evaluateCandidates,
  ingestGreenhouseRawJobs,
  normalizeGreenhouseRawJobsToCandidates,
} from "../../../../../../lib/sourcing/pipeline/greenhouseSteps";
import { enrichCandidatesSalaryBulk } from "../../../../../../lib/sourcing/pipeline/salaryEnrichment";

export const runtime = "nodejs";

type SourceRow = {
  id: string;
  source_type: string;
  validation_state: string;
  enabled: boolean;
};

async function requireAdminOrCronSecret(request: Request): Promise<{ ok: true; actorId: string | null } | { ok: false; res: NextResponse }> {
  const secret = new URL(request.url).searchParams.get("secret");
  const expected = getSourcingCronSecret();
  if (expected && secret && secret === expected) {
    return { ok: true, actorId: null };
  }
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") {
    return { ok: false, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true, actorId: auth.profile.id };
}

async function runPipelineGreenhouse(args: { sourceId?: string | null; limitRaw?: number; limitCandidates?: number; actorId: string | null }) {
  if (!supabaseAdmin) throw new Error("Supabase not configured.");

  const sourceId = (args.sourceId || "").trim() || null;
  const limitRaw = Math.min(500, Math.max(1, Number(args.limitRaw) || 300));
  const limitCandidates = Math.min(300, Math.max(1, Number(args.limitCandidates) || 200));

  // 1) Load eligible sources
  let q = supabaseAdmin
    .from("sourcing_sources")
    .select("id,source_type,validation_state,enabled")
    .eq("source_type", "greenhouse")
    .eq("validation_state", "allowed")
    .eq("enabled", true)
    .order("created_at", { ascending: false });
  if (sourceId) q = q.eq("id", sourceId);

  const { data: sources, error: srcErr } = await q;
  if (srcErr) throw new Error("Unable to load sources.");
  const eligibleSources = ((sources as SourceRow[] | null) || []).filter((s) => s.enabled && s.validation_state === "allowed");

  const pipeSummary = {
    sources_processed: eligibleSources.length,
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

  // 2) Ingest per source (keeps run rows separate and debuggable)
  for (const s of eligibleSources) {
    const out = await ingestGreenhouseRawJobs(supabaseAdmin, { sourceId: s.id });
    pipeSummary.ingestion.ran += Number(out.ran || 0) || 0;
    pipeSummary.ingestion.results.push(...(out.results || []));
  }

  pipeSummary.runs_created = pipeSummary.ingestion.results.filter((r: any) => Boolean(r?.runId)).length;
  pipeSummary.raw_fetched = pipeSummary.ingestion.results.reduce((acc: number, r: any) => acc + (Number(r?.fetchedCount) || 0), 0);
  pipeSummary.raw_inserted = pipeSummary.ingestion.results.reduce((acc: number, r: any) => acc + (Number(r?.insertedCount) || 0), 0);
  pipeSummary.raw_skipped = pipeSummary.ingestion.results.reduce((acc: number, r: any) => acc + (Number(r?.skippedCount) || 0), 0);

  // 3-6) Normalize → Evaluate → Salary enrichment → Auto-publish
  // IMPORTANT: when sourceId is NOT provided, run these per-source to avoid one busy source starving others via global limits.
  const sourcesToProcess = sourceId ? eligibleSources : eligibleSources;
  const perSourceRawLimit = sourceId ? limitRaw : Math.max(60, Math.ceil(limitRaw / Math.max(1, eligibleSources.length)));
  const perSourceCandidateLimit = sourceId ? limitCandidates : Math.max(60, Math.ceil(limitCandidates / Math.max(1, eligibleSources.length)));

  const publishedJobIdsAll: string[] = [];
  const duplicateJobIdsAll: string[] = [];

  for (const s of sourcesToProcess) {
    const sid = sourceId ? sourceId : s.id;

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

    // Enrich salary for a small batch of missing-salary candidates (conservative, cooldown-aware).
    const sal = await enrichCandidatesSalaryBulk(supabaseAdmin, {
      sourceId: sid,
      limit: 18,
      concurrency: 2,
      cooldownHours: 24,
      scanLimit: 220,
    });
    pipeSummary.salary_enrichment.scanned += Number(sal.scanned || 0) || 0;
    pipeSummary.salary_enrichment.attempted += Number(sal.attempted || 0) || 0;
    pipeSummary.salary_enrichment.updated += Number(sal.updated || 0) || 0;
    pipeSummary.salary_enrichment.reopened += Number(sal.reopened || 0) || 0;
    pipeSummary.salary_enrichment.not_found += Number(sal.not_found || 0) || 0;
    pipeSummary.salary_enrichment.failed += Number(sal.failed || 0) || 0;
    pipeSummary.salary_enrichment.skipped_recent += Number(sal.skipped_recent || 0) || 0;

    const pub = await autoPublishEligibleCandidates(supabaseAdmin, { actorId: args.actorId, sourceId: sid, limit: 120 });
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
      normalization: norm,
      evaluation: ev,
      salary_enrichment: sal,
      auto_publish: {
        processed: Number((pub as any).processed || 0) || 0,
        published: Number((pub as any).published || 0) || 0,
        failed: Number((pub as any).failed || 0) || 0,
      },
    });

    if (sourceId) break;
  }

  pipeSummary.auto_publish.skipped_total = pipeSummary.auto_publish.skipped_duplicates + pipeSummary.auto_publish.skipped_not_eligible;
  (pipeSummary.auto_publish as any).published_job_ids = Array.from(new Set(publishedJobIdsAll)).slice(0, 60);
  (pipeSummary.auto_publish as any).duplicate_job_ids = Array.from(new Set(duplicateJobIdsAll)).slice(0, 60);

  // Optional: audit a pipeline run (cron actorId=null).
  await supabaseAdmin.from("audit_logs").insert({
    actor_id: args.actorId,
    action: "sourcing_greenhouse_pipeline_run",
    metadata: pipeSummary,
  });

  return pipeSummary;
}

export async function POST(request: Request) {
  const gate = await requireAdminOrCronSecret(request);
  if (!gate.ok) return gate.res;
  const body = (await request.json().catch(() => ({}))) as { sourceId?: string; limitRaw?: number; limitCandidates?: number };
  try {
    const summary = await runPipelineGreenhouse({
      sourceId: (body.sourceId || "").trim() || null,
      limitRaw: body.limitRaw,
      limitCandidates: body.limitCandidates,
      actorId: gate.actorId,
    });
    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Pipeline failed" }, { status: 500 });
  }
}

// Vercel cron calls GET. Protect with ?secret=...
export async function GET(request: Request) {
  const gate = await requireAdminOrCronSecret(request);
  if (!gate.ok) return gate.res;
  const url = new URL(request.url);
  const sourceId = (url.searchParams.get("sourceId") || "").trim() || null;
  try {
    const summary = await runPipelineGreenhouse({ sourceId, actorId: gate.actorId });
    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Pipeline failed" }, { status: 500 });
  }
}

