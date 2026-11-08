import { NextResponse } from "next/server";
import { isTwiceWeeklySendDay } from "../../../../lib/alertPrefs";
import { sendDigest } from "../../../../lib/alerts/sendDigest";

export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const url = new URL(request.url);
  const secret = (url.searchParams.get("secret") || "").trim();
  const alerts = (process.env.ALERTS_CRON_SECRET || "").trim();
  const cron = (process.env.CRON_SECRET || "").trim();
  const auth = request.headers.get("authorization") || "";
  if (request.headers.get("x-vercel-cron") === "1") return true;
  if (cron && auth === `Bearer ${cron}`) return true;
  if (alerts && auth === `Bearer ${alerts}`) return true;
  if (alerts && secret === alerts) return true;
  if (cron && secret === cron) return true;
  return false;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const force = url.searchParams.get("force") === "1";
  const trial = url.searchParams.get("trial") === "1";
  const now = new Date();
  if (!force && !trial && !isTwiceWeeklySendDay(now)) {
    return NextResponse.json({ ok: true, skipped: "not_send_day", dayUtc: now.getUTCDay() });
  }
  const result = await sendDigest({ dryRun, force, trial });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json(result);
}
