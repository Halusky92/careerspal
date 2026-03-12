import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../../lib/supabaseServerAuth";

export const runtime = "nodejs";

const toInt = (value: string | null, fallback: number) => {
  const n = Number.parseInt((value || "").trim(), 10);
  return Number.isFinite(n) ? n : fallback;
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
  const sourceId = (url.searchParams.get("sourceId") || "").trim();
  const limit = Math.min(200, Math.max(1, toInt(url.searchParams.get("limit"), 50)));

  let q = supabaseAdmin
    .from("sourcing_source_runs")
    .select("id,source_id,status,started_at,finished_at,fetched_count,new_raw_count,inserted_count,skipped_count,error_summary,http_summary,created_at")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (sourceId) q = q.eq("source_id", sourceId);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: "Unable to load runs." }, { status: 500 });
  }

  return NextResponse.json({ runs: data || [] });
}

