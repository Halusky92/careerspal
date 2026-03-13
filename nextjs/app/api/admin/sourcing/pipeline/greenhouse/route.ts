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
    auto_publish: {
      processed: 0,
      published: 0,
      skipped_total: 0,
      skipped_duplicates: 0,
      skipped_not_eligible: 0,
      failed: 0,
      minScore: null as number | null,
    },
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

  // 3) Normalize latest raw jobs (scoped by source if provided)
  const norm = await normalizeGreenhouseRawJobsToCandidates(supabaseAdmin, { sourceId, limit: limitRaw });
  pipeSummary.normalization.processed = Number(norm.processed || 0) || 0;
  pipeSummary.normalization.inserted = Number(norm.inserted || 0) || 0;
  pipeSummary.normalization.updated = Number(norm.updated || 0) || 0;
  pipeSummary.normalization.skipped = Number(norm.skipped || 0) || 0;
  pipeSummary.normalization.errors = Array.isArray(norm.errors) ? norm.errors.length : 0;

  // 4) Evaluate candidates
  const ev = await evaluateCandidates(supabaseAdmin, { sourceId, limit: limitCandidates });
  pipeSummary.evaluation.processed = Number(ev.processed || 0) || 0;
  pipeSummary.evaluation.evaluated = Number(ev.evaluated || 0) || 0;
  pipeSummary.evaluation.errors = Array.isArray(ev.errors) ? ev.errors.length : 0;

  // 5) Auto-publish
  const pub = await autoPublishEligibleCandidates(supabaseAdmin, { actorId: args.actorId, sourceId, limit: 100 });
  pipeSummary.auto_publish.processed = Number(pub.processed || 0) || 0;
  pipeSummary.auto_publish.published = Number(pub.published || 0) || 0;
  pipeSummary.auto_publish.failed = Number(pub.failed || 0) || 0;
  pipeSummary.auto_publish.minScore = typeof pub.minScore === "number" ? pub.minScore : null;

  const pubResults = Array.isArray((pub as any).results) ? ((pub as any).results as any[]) : [];
  pipeSummary.auto_publish.skipped_duplicates = pubResults.filter((r) => r?.status === "skipped_duplicate").length;
  pipeSummary.auto_publish.skipped_not_eligible = pubResults.filter((r) => r?.status === "skipped").length;
  pipeSummary.auto_publish.skipped_total = pipeSummary.auto_publish.skipped_duplicates + pipeSummary.auto_publish.skipped_not_eligible;

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

