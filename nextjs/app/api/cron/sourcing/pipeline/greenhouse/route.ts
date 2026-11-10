import { NextResponse } from "next/server";
import { getSourcingCronSecret } from "@/lib/sourcing/config";
import { runPipelineGreenhouse, writeSourcingCronHealth } from "@/lib/sourcing/runGreenhousePipeline";
import { parseSliceMode } from "@/lib/sourcing/pipeline/slice";

export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const url = new URL(request.url);
  const secret = (url.searchParams.get("secret") || "").trim();
  const expected = getSourcingCronSecret();
  const cron = (process.env.CRON_SECRET || "").trim();
  const alerts = (process.env.ALERTS_CRON_SECRET || "").trim();
  const auth = request.headers.get("authorization") || "";
  if (request.headers.get("x-vercel-cron") === "1") return true;
  if (expected && secret === expected) return true;
  if (cron && (secret === cron || auth === `Bearer ${cron}`)) return true;
  if (alerts && secret === alerts) return true;
  return false;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    await writeSourcingCronHealth({
      status: "unauthorized",
      trigger: "cron",
      at: new Date().toISOString(),
    }).catch(() => undefined);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  const secretConfigured = Boolean(getSourcingCronSecret());
  await writeSourcingCronHealth({
    status: "started",
    trigger: "vercel-cron",
    at: startedAt,
    secretConfigured,
  }).catch(() => undefined);

  const mode = parseSliceMode(new URL(request.url).searchParams.get("mode"));
  try {
    const summary = await runPipelineGreenhouse({
      actorId: null,
      trigger: "cron",
      mode,
      maxSources: 1,
      limitRaw: 25,
      limitCandidates: 40,
      includeSalaryEnrichment: mode === "salary",
      includeLogoBackfill: false,
      timeBudgetMs: 45_000,
    });
    await writeSourcingCronHealth({
      status: summary.timed_out ? "partial" : "ok",
      trigger: "vercel-cron",
      startedAt,
      finishedAt: new Date().toISOString(),
      secretConfigured,
      sourcesProcessed: summary.sources_processed,
      published: summary.auto_publish.published,
      rawInserted: summary.raw_inserted,
      timedOut: summary.timed_out,
      failedStep: summary.failed_step,
    }).catch(() => undefined);
    return NextResponse.json({ ok: true, mode, done: summary.done, summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pipeline failed";
    await writeSourcingCronHealth({
      status: "error",
      trigger: "vercel-cron",
      startedAt,
      finishedAt: new Date().toISOString(),
      secretConfigured,
      error: message,
    }).catch(() => undefined);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
