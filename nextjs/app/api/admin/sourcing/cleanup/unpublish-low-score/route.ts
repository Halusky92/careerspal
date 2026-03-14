import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../../../lib/supabaseServerAuth";

export const runtime = "nodejs";

const clampInt = (n: unknown, min: number, max: number, fallback: number) => {
  const v = typeof n === "number" ? n : Number.parseInt(String(n ?? ""), 10);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(v)));
};

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function POST(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }
  const sb = supabaseAdmin;
  const actorId = auth.profile.id;

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const sourceId = typeof body.sourceId === "string" ? body.sourceId.trim() : "";
  const atsIdentifier = typeof body.atsIdentifier === "string" ? body.atsIdentifier.trim().toLowerCase() : "";
  const minScore = clampInt(body.minScore, 0, 100, 85);
  const maxToProcess = clampInt(body.maxToProcess, 1, 1000, 500);

  if (!sourceId && !atsIdentifier) {
    return NextResponse.json({ error: "Missing sourceId or atsIdentifier." }, { status: 400 });
  }

  let sourceIds: string[] = [];
  if (sourceId) {
    sourceIds = [sourceId];
  } else {
    const { data: sources, error: srcErr } = await sb
      .from("sourcing_sources")
      .select("id")
      .eq("source_type", "greenhouse")
      .ilike("ats_identifier", atsIdentifier);

    if (srcErr) return NextResponse.json({ error: `Unable to load sources: ${srcErr.message}` }, { status: 500 });
    sourceIds = (sources || []).map((s: any) => s.id).filter(Boolean);
  }

  if (!sourceIds.length) {
    return NextResponse.json({ ok: true, sourceIds: [], unpublished: 0, reason: "no_sources" });
  }

  // 1) Find candidates that are already published (via sourcing) for these source ids.
  const { data: candRows, error: candErr } = await sb
    .from("sourcing_sourced_job_candidates")
    .select("id,source_id,published_job_id,publish_status,publish_notes")
    .in("source_id", sourceIds)
    .not("published_job_id", "is", null)
    .limit(maxToProcess);

  if (candErr) {
    return NextResponse.json({ error: `Unable to load candidates: ${candErr.message}` }, { status: 500 });
  }

  const publishedCandidates = (candRows || []).filter((r: any) => !!r.published_job_id);
  if (!publishedCandidates.length) {
    return NextResponse.json({ ok: true, sourceIds, scanned: 0, unpublished: 0, reason: "no_published_candidates" });
  }

  // 2) Load scores for these candidates and select those below minScore.
  const idList = publishedCandidates.map((c: any) => c.id as string);
  const scoreMap = new Map<string, number>();
  for (const group of chunk(idList, 200)) {
    const { data: scores, error: scoreErr } = await sb
      .from("sourcing_candidate_scores")
      .select("candidate_id,score_total")
      .in("candidate_id", group);
    if (scoreErr) return NextResponse.json({ error: `Unable to load scores: ${scoreErr.message}` }, { status: 500 });
    for (const s of scores || []) scoreMap.set((s as any).candidate_id, Number((s as any).score_total ?? 0) || 0);
  }

  const low = publishedCandidates
    .map((c: any) => ({ ...c, score_total: scoreMap.get(c.id) ?? null }))
    .filter((c: any) => typeof c.score_total === "number" && c.score_total < minScore);

  if (!low.length) {
    return NextResponse.json({ ok: true, sourceIds, scanned: publishedCandidates.length, unpublished: 0, reason: "none_below_threshold", minScore });
  }

  const jobIds = Array.from(new Set(low.map((c: any) => c.published_job_id).filter(Boolean))) as string[];
  const candidateIds = low.map((c: any) => c.id as string);

  // 3) Unpublish jobs (safe: do not delete).
  const { error: jobsErr } = await sb
    .from("jobs")
    .update({ status: "draft", published_at: null })
    .in("id", jobIds);
  if (jobsErr) return NextResponse.json({ error: `Unable to unpublish jobs: ${jobsErr.message}` }, { status: 500 });

  // 4) Mark candidates so the UI reflects what happened.
  // Notes vary per row (score), so update individually (counts are expected to be small).
  for (const c of low) {
    const score = (c as any).score_total;
    await sb
      .from("sourcing_sourced_job_candidates")
      .update({
        publish_status: "unpublished_low_score",
        publish_notes: `Unpublished: score=${score} < minScore=${minScore}.`,
      })
      .eq("id", c.id);
  }

  // 5) Audit trail
  await sb.from("audit_logs").insert(
    jobIds.map((jobId) => ({
      actor_id: actorId,
      job_id: jobId,
      action: "sourcing_unpublished_low_score",
      metadata: { sourceIds, minScore, candidateIdsCount: candidateIds.length },
    })),
  );

  return NextResponse.json({
    ok: true,
    sourceIds,
    minScore,
    scanned: publishedCandidates.length,
    below_threshold: low.length,
    unpublished_jobs: jobIds.length,
    jobIds,
    candidateIds,
  });
}

