import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../../../lib/supabaseServerAuth";
import {
  fetchGreenhouseJobDetail,
  fetchGreenhouseJobsList,
  inferGreenhouseBoardTokenFromUrl,
  mapLimit,
  sha256Json,
} from "../../../../../../lib/sourcing/connectors/greenhouse";

export const runtime = "nodejs";

type SourceRow = {
  id: string;
  base_url: string;
  normalized_url: string;
  ats_identifier: string | null;
};

export async function POST(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as { sourceId?: string };
  const sourceId = (body.sourceId || "").trim() || null;

  let query = supabaseAdmin
    .from("sourcing_sources")
    .select("id,base_url,normalized_url,ats_identifier")
    .eq("source_type", "greenhouse")
    .eq("validation_state", "allowed")
    .eq("enabled", true);

  if (sourceId) query = query.eq("id", sourceId);

  const { data: sources, error: srcErr } = await query.order("created_at", { ascending: false });
  if (srcErr) {
    return NextResponse.json({ error: "Unable to load sources." }, { status: 500 });
  }

  const results: any[] = [];
  for (const s of (sources as SourceRow[] | null) || []) {
    const startedAt = new Date().toISOString();

    const { data: runRow } = await supabaseAdmin
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

    const boardToken =
      (s.ats_identifier || "").trim().toLowerCase() || inferGreenhouseBoardTokenFromUrl(s.normalized_url) || null;

    if (!boardToken) {
      if (runId) {
        await supabaseAdmin
          .from("sourcing_source_runs")
          .update({
            status: "failed",
            finished_at: new Date().toISOString(),
            error_summary: "Missing Greenhouse board token (ats_identifier).",
          })
          .eq("id", runId);
      }
      results.push({ sourceId: s.id, status: "failed", error: "Missing board token." });
      continue;
    }

    try {
      const list = await fetchGreenhouseJobsList(boardToken);
      const fetchedCount = list.length;

      let detailFailures = 0;
      const detailRows = await mapLimit(list, 3, async (job) => {
        try {
          const detail = await fetchGreenhouseJobDetail(boardToken, job.id);
          const payloadHash = sha256Json(detail);
          const jobUrl = (job.absolute_url || null) as string | null;
          const title = (job.title || null) as string | null;
          return {
            ok: true as const,
            row: {
              source_id: s.id,
              source_run_id: runId,
              source_type: "greenhouse",
              source_url: s.normalized_url,
              external_job_id: String(job.id),
              job_url: jobUrl,
              title,
              raw_payload: detail,
              payload_hash: payloadHash,
              fetched_at: new Date().toISOString(),
            },
          };
        } catch (e) {
          detailFailures += 1;
          return { ok: false as const, error: e instanceof Error ? e.message : "Detail fetch failed" };
        }
      });

      const rows = detailRows.filter((x) => x.ok).map((x) => (x as any).row);
      const insertAttempted = rows.length;

      let insertedCount = 0;
      if (rows.length > 0) {
        const { data: inserted, error: insErr } = await supabaseAdmin
          .from("sourcing_sourced_jobs_raw")
          .upsert(rows, { onConflict: "source_id,external_job_id", ignoreDuplicates: true })
          .select("id");
        if (insErr) {
          throw new Error("Raw upsert failed.");
        }
        insertedCount = (inserted || []).length;
      }

      const skippedCount = Math.max(0, fetchedCount - insertedCount);
      const finishedAt = new Date().toISOString();
      const status = detailFailures > 0 ? "partial" : "success";

      if (runId) {
        await supabaseAdmin
          .from("sourcing_source_runs")
          .update({
            status,
            finished_at: finishedAt,
            fetched_count: fetchedCount,
            new_raw_count: insertedCount,
            inserted_count: insertedCount,
            skipped_count: skippedCount,
            error_summary: detailFailures > 0 ? `Detail fetch failures: ${detailFailures}` : null,
            http_summary: {
              boardToken,
              fetchedCount,
              insertAttempted,
              insertedCount,
              skippedCount,
              detailFailures,
            },
          })
          .eq("id", runId);
      }

      results.push({
        sourceId: s.id,
        runId,
        status,
        fetchedCount,
        insertedCount,
        skippedCount,
        detailFailures,
      });
    } catch (e) {
      const finishedAt = new Date().toISOString();
      const msg = e instanceof Error ? e.message : "Greenhouse run failed";
      if (runId) {
        await supabaseAdmin
          .from("sourcing_source_runs")
          .update({
            status: "failed",
            finished_at: finishedAt,
            error_summary: msg,
          })
          .eq("id", runId);
      }
      results.push({ sourceId: s.id, runId, status: "failed", error: msg });
    }
  }

  return NextResponse.json({ ran: results.length, results });
}

