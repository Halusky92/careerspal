import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getSourcingCronSecret } from "../../../../lib/sourcing/config";
import { expireStaleJobs, STALE_JOB_DAYS } from "../../../../lib/jobs/expireStaleJobs";
import { purgeUnpublishedJobs } from "../../../../lib/jobs/purgeUnpublishedJobs";
import { UNPUBLISHED_RETENTION_DAYS } from "../../../../lib/jobs/unpublishedRetention";

export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  const sourcing = getSourcingCronSecret();
  const alerts = (process.env.ALERTS_CRON_SECRET || "").trim();
  const cron = (process.env.CRON_SECRET || "").trim();
  const auth = request.headers.get("authorization") || "";
  if (request.headers.get("x-vercel-cron") === "1") return true;
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
  const forcePurge = url.searchParams.get("purge") === "1";
  const isWeeklyPurgeDay = new Date().getUTCDay() === 0;
  try {
    const expired = await expireStaleJobs(supabaseAdmin, { dryRun, days: STALE_JOB_DAYS });
    const shouldPurge = forcePurge || isWeeklyPurgeDay;
    const purged = shouldPurge
      ? await purgeUnpublishedJobs(supabaseAdmin, { dryRun, days: UNPUBLISHED_RETENTION_DAYS })
      : { skipped: true, reason: "weekly Sunday UTC only" };
    return NextResponse.json({ ok: true, expired, purged });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Stale job cleanup failed" },
      { status: 500 },
    );
  }
}
