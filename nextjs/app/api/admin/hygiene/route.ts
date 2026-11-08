import { NextResponse } from "next/server";
import { getSupabaseProfile } from "../../../../lib/supabaseServerAuth";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { sweepDeadApplyLinks } from "../../../../lib/jobs/sweepDeadApplyLinks";
import { expireStaleJobs, STALE_JOB_DAYS } from "../../../../lib/jobs/expireStaleJobs";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }
  try {
    const expired = await expireStaleJobs(supabaseAdmin, { dryRun: false, days: STALE_JOB_DAYS });
    const deadLinks = await sweepDeadApplyLinks(supabaseAdmin, { dryRun: false, limit: 16, timeoutMs: 6000 });
    return NextResponse.json({ ok: true, expired, deadLinks });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Hygiene failed" },
      { status: 500 },
    );
  }
}
