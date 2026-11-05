import { NextResponse } from "next/server";
import { loadEmployerOwnedJob, requireEmployer } from "../../../../../../lib/employer";
import {
  LISTING_STATS_DAYS,
  applyClickRate,
  buildDailyTraffic,
  rollupTrafficSources,
} from "../../../../../../lib/jobListingStats";
import { supabaseAdmin } from "../../../../../../lib/supabaseAdmin";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireEmployer(request);
  if ("error" in auth) return auth.error;
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const { id } = await context.params;
  const owned = await loadEmployerOwnedJob(id, auth.profileId);
  if (!owned.job) {
    const status = owned.error === "forbidden" || owned.error === "sourced" ? 403 : 404;
    return NextResponse.json({ error: "Job not found." }, { status });
  }

  const since = new Date(Date.now() - LISTING_STATS_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const sourceSince = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const [viewsRes, appliesRes, savesRes, logsRes] = await Promise.all([
    supabaseAdmin.from("job_views").select("created_at").eq("job_id", id).order("created_at", { ascending: true }),
    supabaseAdmin.from("job_matches").select("created_at").eq("job_id", id).order("created_at", { ascending: true }),
    supabaseAdmin.from("saved_jobs").select("job_id", { count: "exact", head: true }).eq("job_id", id),
    supabaseAdmin
      .from("audit_logs")
      .select("action, metadata")
      .eq("job_id", id)
      .in("action", ["view", "match", "apply_click"])
      .gte("created_at", sourceSince),
  ]);

  const viewTimes = ((viewsRes.data || []) as { created_at?: string }[])
    .map((row) => row.created_at)
    .filter((value): value is string => Boolean(value));
  const applyTimes = ((appliesRes.data || []) as { created_at?: string }[])
    .map((row) => row.created_at)
    .filter((value): value is string => Boolean(value));

  const views = Math.max(owned.job.views || 0, viewTimes.length);
  const applyClicks = Math.max(owned.job.matches || 0, applyTimes.length);
  const saves = savesRes.count || 0;

  return NextResponse.json({
    jobId: id,
    views,
    applyClicks,
    saves,
    applyRate: applyClickRate(views, applyClicks),
    days: buildDailyTraffic(
      viewTimes.filter((time) => time >= since),
      applyTimes.filter((time) => time >= since),
    ),
    sources: rollupTrafficSources((logsRes.data || []) as Array<{ action?: string | null; metadata?: { source?: string | null } | null }>),
  });
}
