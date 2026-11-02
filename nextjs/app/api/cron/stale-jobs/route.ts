import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getSourcingCronSecret } from "../../../../lib/sourcing/config";
import { expireStaleJobs, STALE_JOB_DAYS } from "../../../../lib/jobs/expireStaleJobs";

export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  const sourcing = getSourcingCronSecret();
  const alerts = (process.env.ALERTS_CRON_SECRET || "").trim();
  const cron = (process.env.CRON_SECRET || "").trim();
  const auth = request.headers.get("authorization") || "";
  if (cron && auth === `Bearer ${cron}`) return true;
  if (sourcing && secret === sourcing) return true;
  if (alerts && secret === alerts) return true;
  if (!sourcing && !alerts && !cron) return true;
  return false;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }
  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  try {
    const summary = await expireStaleJobs(supabaseAdmin, { dryRun, days: STALE_JOB_DAYS });
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Stale job cleanup failed" },
      { status: 500 },
    );
  }
}
