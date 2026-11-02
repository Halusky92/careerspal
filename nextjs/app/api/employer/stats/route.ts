import { NextResponse } from "next/server";
import { listingSourceLabel } from "../../../../lib/listingTraffic";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../lib/supabaseServerAuth";

type SourceRow = { source: string; label: string; views: number; applyClicks: number };

export async function GET(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (!auth?.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const profileId = auth.profile.id;
  if (!profileId) {
    return NextResponse.json({ jobs: 0, views: 0, matches: 0, applyClicks: 0, sources: [] });
  }

  let { data, error } = await supabaseAdmin
    .from("jobs")
    .select("id,views,matches,origin")
    .eq("created_by", profileId);
  if (error) {
    const retry = await supabaseAdmin.from("jobs").select("id,views,matches").eq("created_by", profileId);
    data = retry.data as typeof data;
  }
  const owned = (data || []).filter((job: { origin?: string | null }) => (job.origin || "employer") !== "greenhouse");
  const totals = owned.reduce<{ jobs: number; views: number; matches: number }>(
    (acc, job: { views?: number | null; matches?: number | null }) => ({
      jobs: acc.jobs + 1,
      views: acc.views + (job.views || 0),
      matches: acc.matches + (job.matches || 0),
    }),
    { jobs: 0, views: 0, matches: 0 },
  );

  const sourceMap = new Map<string, SourceRow>();
  const jobIds = owned.map((job: { id?: string }) => job.id).filter(Boolean) as string[];
  if (jobIds.length > 0) {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: logs } = await supabaseAdmin
      .from("audit_logs")
      .select("action, metadata, job_id")
      .in("job_id", jobIds.slice(0, 200))
      .in("action", ["view", "match", "apply_click"])
      .gte("created_at", since);
    for (const log of logs || []) {
      const metadata = (log.metadata || {}) as { source?: string };
      const source = (metadata.source || "direct").slice(0, 32);
      const row = sourceMap.get(source) || { source, label: listingSourceLabel(source), views: 0, applyClicks: 0 };
      if (log.action === "view") row.views += 1;
      else row.applyClicks += 1;
      sourceMap.set(source, row);
    }
  }

  const sources = Array.from(sourceMap.values()).sort(
    (a, b) => b.views + b.applyClicks - (a.views + a.applyClicks),
  );

  return NextResponse.json(
    {
      ...totals,
      applyClicks: totals.matches,
      sources,
    },
    { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=120" } },
  );
}
