import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getSourcingCronSecret } from "../../../../lib/sourcing/config";
import {
  GOOGLE_INDEXING_DEFAULT_DAILY_QUOTA,
  googleIndexingLiveEnabled,
  planIndexNotifications,
  type SentNotice,
} from "../../../../lib/googleIndexing/plan";
import { toIndexSnapshot, type IndexJobRow } from "../../../../lib/googleIndexing/snapshot";

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

const JOB_SELECT =
  "id,title,description,location,remote_policy,type,salary,timestamp,published_at,created_at,category,apply_url,status,content_hash,companies(name)";

async function loadJobs(): Promise<{ rows: IndexJobRow[] | null; complete: boolean }> {
  if (!supabaseAdmin) return { rows: null, complete: false };
  const pageSize = 200;
  const rows: IndexJobRow[] = [];
  let offset = 0;
  while (offset <= 20000) {
    const page = await supabaseAdmin.from("jobs").select(JOB_SELECT).range(offset, offset + pageSize - 1);
    if (page.error) return { rows: null, complete: false };
    const chunk = (page.data || []) as IndexJobRow[];
    rows.push(...chunk);
    if (chunk.length < pageSize) return { rows, complete: true };
    offset += pageSize;
  }
  return { rows: null, complete: false };
}

async function loadHistory(): Promise<{ notices: SentNotice[] | null; sentToday: number; ok: boolean; reason: string | null }> {
  if (!supabaseAdmin) return { notices: null, sentToday: 0, ok: false, reason: "notifications_unreadable" };
  const pageSize = 500;
  const notices: SentNotice[] = [];
  let offset = 0;
  while (offset <= 20000) {
    const page = await supabaseAdmin
      .from("google_index_notifications")
      .select("url,job_id,notice_type,fingerprint,state,sent_at")
      .eq("state", "sent")
      .order("sent_at", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (page.error) {
      const code = page.error.code || "";
      const message = page.error.message || "";
      const missing = code === "42P01" || code === "PGRST205" || /google_index_notifications|schema cache/i.test(message);
      return {
        notices: null,
        sentToday: 0,
        ok: false,
        reason: missing ? "notifications_table_missing" : "notifications_unreadable",
      };
    }
    const chunk = page.data || [];
    for (const row of chunk) {
      if (!row.url || (row.notice_type !== "URL_UPDATED" && row.notice_type !== "URL_DELETED")) continue;
      notices.push({
        url: row.url,
        jobId: row.job_id || null,
        type: row.notice_type,
        fingerprint: row.fingerprint || "",
        sentAt: row.sent_at || "",
      });
    }
    if (chunk.length < pageSize) break;
    offset += pageSize;
  }
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const sentToday = notices.filter((notice) => notice.sentAt >= start.toISOString()).length;
  return { notices, sentToday, ok: true, reason: null };
}

function quotaFrom(request: Request): number {
  const raw = Number(new URL(request.url).searchParams.get("dailyQuota") || "");
  if (!Number.isFinite(raw) || raw < 1) return GOOGLE_INDEXING_DEFAULT_DAILY_QUOTA;
  return Math.min(10_000, Math.floor(raw));
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const loaded = await loadJobs();
  const history = loaded.complete
    ? await loadHistory()
    : { notices: null, sentToday: 0, ok: false, reason: "jobs_unreadable" as string | null };
  if (!history.ok) {
    return NextResponse.json(
      {
        ok: false,
        dryRun: true,
        liveSending: false,
        aborted: history.reason,
        totalUpdated: 0,
        totalDeleted: 0,
        batchUpdated: 0,
        batchDeleted: 0,
        deferred: 0,
        skippedUnchanged: 0,
        sentToday: 0,
        dailyQuota: quotaFrom(request),
        remainingQuota: 0,
        updated: [],
        deleted: [],
      },
      { status: 503 },
    );
  }
  const plan = planIndexNotifications({
    jobs: loaded.rows ? loaded.rows.map(toIndexSnapshot) : null,
    jobsReadOk: loaded.complete,
    scanComplete: loaded.complete,
    history: history.notices,
    historyReadOk: history.ok,
    sentToday: history.sentToday,
    dailyQuota: quotaFrom(request),
  });
  return NextResponse.json({
    ok: plan.aborted == null,
    dryRun: true,
    liveSending: googleIndexingLiveEnabled(),
    aborted: plan.aborted,
    totalUpdated: plan.totalUpdated,
    totalDeleted: plan.totalDeleted,
    batchUpdated: plan.batchUpdated,
    batchDeleted: plan.batchDeleted,
    deferred: plan.deferred,
    skippedUnchanged: plan.skippedUnchanged,
    sentToday: plan.sentToday,
    dailyQuota: plan.dailyQuota,
    remainingQuota: plan.remainingQuota,
    updated: plan.updated.map((item) => item.url),
    deleted: plan.deleted.map((item) => item.url),
  });
}
