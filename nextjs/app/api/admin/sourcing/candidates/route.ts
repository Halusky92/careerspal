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
  const runId = (url.searchParams.get("runId") || "").trim();
  const limit = Math.min(200, Math.max(1, toInt(url.searchParams.get("limit"), 50)));

  let q = supabaseAdmin
    .from("sourcing_sourced_job_candidates")
    .select(
      "id,raw_job_id,source_id,source_run_id,external_job_id,title,company_name,apply_url,job_url,location_text,remote_policy,posted_at,salary_present,salary_currency,salary_period,salary_amount_min,salary_amount_max,published_job_id,published_at,publish_status,publish_notes,created_at,updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (sourceId) q = q.eq("source_id", sourceId);
  if (runId) q = q.eq("source_run_id", runId);

  const { data, error } = await q;
  if (error) {
    return NextResponse.json(
      {
        error: `Unable to load candidates: ${error.message || "unknown_error"}`,
        code: (error as any).code || null,
        hint: (error as any).hint || null,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ candidates: data || [] });
}

