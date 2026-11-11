import { NextResponse } from "next/server";
import { isWeeklySendDay } from "../../../../lib/alertPrefs";
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
  const daily = await sendDigest({ dryRun, force, trial, cadence: "daily" });
  if (!daily.ok) {
    return NextResponse.json({ error: daily.error }, { status: 500 });
  }
  if (!force && !trial && !isWeeklySendDay(now)) {
    return NextResponse.json({ ok: true, cadence: "daily", daily });
  }
  const weekly = await sendDigest({ dryRun, force, trial, cadence: "weekly" });
  if (!weekly.ok) {
    return NextResponse.json({ error: weekly.error, daily }, { status: 500 });
  }
  return NextResponse.json({ ok: true, cadence: "daily+weekly", daily, weekly });
}
