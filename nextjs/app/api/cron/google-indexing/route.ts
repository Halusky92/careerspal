import { NextResponse } from "next/server";
import { publishIndexNotification } from "../../../../lib/googleIndexing/client";
import { indexingCredentials, indexingLiveEnabled } from "../../../../lib/googleIndexing/credentials";
import { GOOGLE_INDEXING_DEFAULT_DAILY_QUOTA } from "../../../../lib/googleIndexing/plan";
import { prepareIndexing } from "../../../../lib/googleIndexing/prepare";
import { batchCap, descriptionReadCap } from "../../../../lib/googleIndexing/quota";
import { executeIndexingRun } from "../../../../lib/googleIndexing/run";
import { HOURLY_EARLY_ACCESS_AUTOMATION } from "../../../../lib/googleIndexing/select";
import { claimIndexingLock, recordIndexNotice, releaseIndexingLock } from "../../../../lib/googleIndexing/store";
import { getSourcingCronSecret } from "../../../../lib/sourcing/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(request: Request): boolean {
  const sourcing = getSourcingCronSecret();
  const cron = (process.env.CRON_SECRET || "").trim();
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  if (!bearer) return false;
  if (cron && bearer === cron) return true;
  if (sourcing && bearer === sourcing) return true;
  return false;
}

function dailyQuota(request: Request): number {
  const raw = Number(new URL(request.url).searchParams.get("dailyQuota") || process.env.GOOGLE_INDEXING_DAILY_QUOTA || "");
  if (!Number.isFinite(raw) || raw < 1) return GOOGLE_INDEXING_DEFAULT_DAILY_QUOTA;
  return Math.min(10_000, Math.floor(raw));
}

function requestedBatch(request: Request): number | null {
  const raw = Number(new URL(request.url).searchParams.get("batch") || "");
  if (!Number.isFinite(raw) || raw < 1) return null;
  return Math.floor(raw);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const liveRequested = indexingLiveEnabled() && url.searchParams.get("live") === "1";
  const credentials = indexingCredentials();
  if (liveRequested && !credentials) {
    return NextResponse.json({ ok: false, dryRun: true, liveSending: false, aborted: "credentials_missing" }, { status: 503 });
  }
  const cap = batchCap({ live: liveRequested, requested: requestedBatch(request) });
  const prepared = await prepareIndexing({
    now: new Date(),
    descriptionCap: descriptionReadCap(cap),
    delta: url.searchParams.get("delta") === "1",
  });
  if (!prepared.historyReadOk || !prepared.jobsReadOk) {
    return NextResponse.json(
      {
        ok: false,
        dryRun: true,
        liveSending: false,
        aborted: prepared.historyReason,
        hourlyAutomation: HOURLY_EARLY_ACCESS_AUTOMATION,
        descriptionsRead: prepared.descriptionsRead,
      },
      { status: 503 },
    );
  }
  const owner = `indexing-${Date.now()}`;
  const run = await executeIndexingRun({
    jobs: prepared.jobs,
    jobsReadOk: prepared.jobsReadOk,
    scanComplete: prepared.scanComplete,
    history: prepared.history,
    historyReadOk: prepared.historyReadOk,
    quotaUsed: prepared.quotaUsed,
    dailyQuota: dailyQuota(request),
    perRunCap: cap,
    live: liveRequested,
    claim: () => claimIndexingLock(owner),
    release: () => releaseIndexingLock(owner),
    publish: async (notice, canAttempt, noteAttempt) => {
      if (!credentials) return { ok: false, status: 0, attempts: 0, retryable: false, error: "credentials_missing" };
      const result = await publishIndexNotification({
        url: notice.url,
        type: notice.type,
        email: credentials.email,
        privateKey: credentials.privateKey,
        canAttempt,
        noteAttempt,
      });
      await new Promise((resolve) => setTimeout(resolve, 250));
      return result;
    },
    record: (notice, result) => recordIndexNotice(notice, result),
  });
  return NextResponse.json({
    ok: run.aborted == null,
    dryRun: run.dryRun,
    liveSending: liveRequested && run.dryRun === false && run.aborted == null,
    aborted: run.aborted,
    totalUpdated: run.plan.totalUpdated,
    totalDeleted: run.plan.totalDeleted,
    batchUpdated: run.plan.batchUpdated,
    batchDeleted: run.plan.batchDeleted,
    deferred: run.plan.deferred,
    skippedUnchanged: run.plan.skippedUnchanged,
    sentToday: run.plan.sentToday,
    dailyQuota: run.plan.dailyQuota,
    remainingQuota: run.plan.remainingQuota,
    updated: run.plan.updated.map((item) => item.url),
    deleted: run.plan.deleted.map((item) => item.url),
    sent: run.sent.map((item) => item.url),
    failed: run.failed.map((item) => item.url),
    unrecorded: run.unrecorded.map((item) => item.url),
    attempts: run.attempts,
    descriptionsRead: prepared.descriptionsRead,
    digestAvailable: prepared.digestAvailable,
    scanComplete: prepared.scanComplete,
    hourlyAutomation: HOURLY_EARLY_ACCESS_AUTOMATION,
  });
}
