import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../../lib/supabaseServerAuth";

export const runtime = "nodejs";

const toInt = (value: string | null, fallback: number) => {
  const n = Number.parseInt((value || "").trim(), 10);
  return Number.isFinite(n) ? n : fallback;
};

function summarizePayloadKeys(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") return [];
  const keys = Object.keys(payload as Record<string, unknown>);
  return keys.slice(0, 20);
}

export async function GET(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const url = new URL(request.url);
  const sourceId = (url.searchParams.get("sourceId") || "").trim();
  const runId = (url.searchParams.get("runId") || "").trim();
  const limit = Math.min(200, Math.max(1, toInt(url.searchParams.get("limit"), 50)));

  let q = supabaseAdmin
    .from("sourcing_sourced_jobs_raw")
    .select("id,source_id,source_run_id,external_job_id,title,job_url,fetched_at,source_type,source_url,raw_payload")
    .order("fetched_at", { ascending: false })
    .limit(limit);

  if (sourceId) q = q.eq("source_id", sourceId);
  if (runId) q = q.eq("source_run_id", runId);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: "Unable to load raw jobs." }, { status: 500 });
  }

  const jobs = (data || []).map((row: any) => ({
    id: row.id,
    source_id: row.source_id,
    source_run_id: row.source_run_id,
    external_job_id: row.external_job_id,
    title: row.title,
    job_url: row.job_url,
    fetched_at: row.fetched_at,
    source_type: row.source_type,
    source_url: row.source_url,
    payload_keys: summarizePayloadKeys(row.raw_payload),
  }));

  return NextResponse.json({ jobs });
}

