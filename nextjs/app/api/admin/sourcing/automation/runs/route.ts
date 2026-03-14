import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../../../lib/supabaseServerAuth";

export const runtime = "nodejs";

const toInt = (value: string | null, fallback: number) => {
  const n = Number.parseInt((value || "").trim(), 10);
  return Number.isFinite(n) ? n : fallback;
};

type AutomationRunRow = {
  id: string;
  actor_id: string | null;
  action: string;
  metadata: any;
  created_at: string;
};

export async function GET(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const url = new URL(request.url);
  const limit = Math.min(60, Math.max(1, toInt(url.searchParams.get("limit"), 14)));

  const { data: logs, error } = await supabaseAdmin
    .from("audit_logs")
    .select("id,actor_id,action,metadata,created_at")
    .eq("action", "sourcing_greenhouse_pipeline_run")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: "Unable to load automation runs." }, { status: 500 });
  }

  // Normalize a small, UI-friendly shape (avoid coupling UI to raw metadata).
  const runs = ((logs as AutomationRunRow[] | null) || []).map((row) => {
    const m = (row.metadata || {}) as any;
    const ap = (m.auto_publish || {}) as any;
    const publishedJobIds: string[] = Array.isArray(ap.published_job_ids) ? ap.published_job_ids.filter(Boolean) : [];
    const duplicateJobIds: string[] = Array.isArray(ap.duplicate_job_ids) ? ap.duplicate_job_ids.filter(Boolean) : [];
    return {
      id: row.id,
      createdAt: row.created_at,
      actorId: row.actor_id,
      sourcesProcessed: Number(m.sources_processed || 0) || 0,
      ingestion: {
        rawFetched: Number(m.raw_fetched || 0) || 0,
        rawInserted: Number(m.raw_inserted || 0) || 0,
        rawSkipped: Number(m.raw_skipped || 0) || 0,
        runsCreated: Number(m.runs_created || 0) || 0,
      },
      normalization: {
        processed: Number(m.normalization?.processed || 0) || 0,
        inserted: Number(m.normalization?.inserted || 0) || 0,
        updated: Number(m.normalization?.updated || 0) || 0,
        skipped: Number(m.normalization?.skipped || 0) || 0,
        errors: Number(m.normalization?.errors || 0) || 0,
      },
      evaluation: {
        processed: Number(m.evaluation?.processed || 0) || 0,
        evaluated: Number(m.evaluation?.evaluated || 0) || 0,
        errors: Number(m.evaluation?.errors || 0) || 0,
      },
      autoPublish: {
        minScore: typeof ap.minScore === "number" ? ap.minScore : null,
        processed: Number(ap.processed || 0) || 0,
        published: Number(ap.published || 0) || 0,
        failed: Number(ap.failed || 0) || 0,
        skippedTotal: Number(ap.skipped_total || 0) || 0,
        skippedDuplicates: Number(ap.skipped_duplicates || 0) || 0,
        skippedNotEligible: Number(ap.skipped_not_eligible || 0) || 0,
        publishedJobIds,
        duplicateJobIds,
      },
    };
  });

  return NextResponse.json({ runs });
}

