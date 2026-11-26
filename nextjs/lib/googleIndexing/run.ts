import { descriptionSha, planIndexNotifications, type IndexPlan, type NoticeType, type SentNotice } from "./plan";
import type { PublishResult } from "./client";

export type PlannedNotice = {
  url: string;
  jobId: string | null;
  type: NoticeType;
  fingerprint: string;
};

export type IndexingRunResult = {
  dryRun: boolean;
  aborted: string | null;
  plan: IndexPlan;
  sent: PlannedNotice[];
  confirmed: PlannedNotice[];
  unconfirmed: PlannedNotice[];
  failed: PlannedNotice[];
  unrecorded: PlannedNotice[];
  rejected: PlannedNotice[];
  attempts: number;
};

export type ApprovalItem = {
  url: string;
  fingerprint: string;
  type: NoticeType;
};

export async function executeIndexingRun(input: {
  jobs: Parameters<typeof planIndexNotifications>[0]["jobs"];
  jobsReadOk: boolean;
  scanComplete: boolean;
  history: SentNotice[] | null;
  historyReadOk: boolean;
  quotaUsed: number;
  dailyQuota: number;
  perRunCap: number;
  live: boolean;
  approved?: ApprovalItem[] | null;
  claim?: () => Promise<boolean>;
  release?: () => Promise<void>;
  publish?: (notice: PlannedNotice, canAttempt: () => boolean, noteAttempt: () => void) => Promise<PublishResult>;
  record?: (notice: PlannedNotice, result: PublishResult) => Promise<boolean>;
}): Promise<IndexingRunResult> {
  const plan = planIndexNotifications({
    jobs: input.jobs,
    jobsReadOk: input.jobsReadOk,
    scanComplete: input.scanComplete,
    history: input.history,
    historyReadOk: input.historyReadOk,
    sentToday: input.quotaUsed,
    dailyQuota: input.dailyQuota,
    perRunCap: input.perRunCap,
  });
  const empty = {
    dryRun: !input.live,
    aborted: plan.aborted,
    plan,
    sent: [] as PlannedNotice[],
    confirmed: [] as PlannedNotice[],
    unconfirmed: [] as PlannedNotice[],
    failed: [] as PlannedNotice[],
    unrecorded: [] as PlannedNotice[],
    rejected: [] as PlannedNotice[],
    attempts: 0,
  };
  if (!input.live || plan.aborted) return { ...empty, dryRun: true };
  const approved = input.approved || [];
  if (approved.length === 0) return { ...empty, dryRun: true, aborted: "approval_required" };
  const eligible = new Map<string, PlannedNotice>();
  for (const item of plan.candidates) eligible.set(`${item.url}\nURL_UPDATED\n${item.fingerprint}`, { ...item, type: "URL_UPDATED" });
  for (const item of plan.deleted) eligible.set(`${item.url}\nURL_DELETED\n${item.fingerprint}`, { ...item, type: "URL_DELETED" });
  const notices: PlannedNotice[] = [];
  const rejected: PlannedNotice[] = [];
  const seen = new Set<string>();
  for (const item of approved) {
    const key = `${item.url}\n${item.type}\n${item.fingerprint}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const notice = eligible.get(key);
    if (!notice) rejected.push({ url: item.url, jobId: null, type: item.type, fingerprint: item.fingerprint });
    else notices.push(notice);
  }
  if (notices.length === 0) return { ...empty, dryRun: true, aborted: "approval_mismatch", rejected };
  if (!input.claim || !input.publish || !input.record) return { ...empty, dryRun: true, aborted: "live_not_configured", rejected };
  const claimed = await input.claim();
  if (!claimed) return { ...empty, dryRun: true, aborted: "lock_unavailable", rejected };
  let used = input.quotaUsed;
  const sent: PlannedNotice[] = [];
  const confirmed: PlannedNotice[] = [];
  const unconfirmed: PlannedNotice[] = [];
  const failed: PlannedNotice[] = [];
  const unrecorded: PlannedNotice[] = [];
  let attempts = 0;
  try {
    for (const notice of notices) {
      if (used >= input.dailyQuota) break;
      const result = await input.publish(
        notice,
        () => used < input.dailyQuota,
        () => {
          used += 1;
          attempts += 1;
        },
      );
      if (!result.ok) {
        const recorded = await input.record(notice, result);
        if (!recorded) unrecorded.push(notice);
        else failed.push(notice);
        continue;
      }
      const recorded = await input.record(notice, result);
      if (!recorded) unrecorded.push(notice);
      else if (result.notifyTime) {
        confirmed.push(notice);
        sent.push(notice);
      } else {
        unconfirmed.push(notice);
        sent.push(notice);
      }
    }
  } finally {
    await input.release?.();
  }
  return { dryRun: false, aborted: null, plan, sent, confirmed, unconfirmed, failed, unrecorded, rejected, attempts };
}

export async function recordWithRetry(
  write: () => Promise<boolean>,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      if (await write()) return true;
    } catch {
      // The Google response is already final. Retry only the history write.
    }
    if (attempt < 2) await sleep(200 * 2 ** attempt);
  }
  return false;
}

export { descriptionSha };
