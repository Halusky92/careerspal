import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../../../lib/supabaseServerAuth";
import { applyLiveBoardFilter } from "../../../../../../lib/liveBoard";
import { buildSourcingOverview, type OverviewRun } from "../../../../../../lib/sourcing/sourcingOverview";

export const runtime = "nodejs";

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function GET(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const month = new Date().toISOString().slice(0, 7);
  const [boards, sources, runs, usage, jobs] = await Promise.all([
    supabaseAdmin.from("sourcing_discovery_boards").select("provider,identifier"),
    supabaseAdmin.from("sourcing_sources").select("source_type,ats_identifier,enabled,validation_state,created_at,company_id,companies(created_at)"),
    supabaseAdmin.from("audit_logs").select("metadata,created_at").eq("action", "sourcing_greenhouse_pipeline_run").gte("created_at", since).order("created_at", { ascending: false }).limit(100),
    supabaseAdmin.from("sourcing_discovery_usage").select("search_count").eq("month_key", month).maybeSingle(),
    applyLiveBoardFilter(supabaseAdmin.from("jobs").select("id", { count: "exact", head: true }).eq("status", "published")),
  ]);

  const overviewRuns: OverviewRun[] | null = runs.error
    ? null
    : ((runs.data || []) as Array<{ created_at: string; metadata: Record<string, any> | null }>).map((row) => {
        const metadata = row.metadata || {};
        return {
          createdAt: row.created_at,
          trigger: metadata.trigger ? String(metadata.trigger) : null,
          failedStep: metadata.failed_step ? String(metadata.failed_step) : null,
          timedOut: Boolean(metadata.timed_out),
          published: numberOrNull(metadata.auto_publish?.published),
          closed: numberOrNull(metadata.close_from_board?.closed),
        };
      });

  return NextResponse.json(
    buildSourcingOverview({
      now: new Date(),
      boards: boards.error ? null : ((boards.data || []) as Array<{ provider: string; identifier: string }>),
      sources: sources.error
        ? null
        : ((sources.data || []) as any[]).map((row) => ({
            sourceType: row.source_type,
            identifier: row.ats_identifier,
            enabled: row.enabled === true,
            validationState: String(row.validation_state || ""),
            createdAt: row.created_at,
            companyId: row.company_id,
            companyCreatedAt: (Array.isArray(row.companies) ? row.companies[0]?.created_at : row.companies?.created_at) || null,
          })),
      runs: overviewRuns,
      publishedJobs: jobs.error ? null : jobs.count ?? null,
      tavilySearches: usage.error ? null : usage.data?.search_count ?? 0,
    }),
  );
}
