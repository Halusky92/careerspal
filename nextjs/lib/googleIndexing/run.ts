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
  failed: PlannedNotice[];
  unrecorded: PlannedNotice[];
  attempts: number;
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
    failed: [] as PlannedNotice[],
    unrecorded: [] as PlannedNotice[],
    attempts: 0,
  };
  if (!input.live || plan.aborted) return { ...empty, dryRun: true };
  if (!input.claim || !input.publish || !input.record) return { ...empty, dryRun: true, aborted: "live_not_configured" };
  const claimed = await input.claim();
  if (!claimed) return { ...empty, dryRun: true, aborted: "lock_unavailable" };
  let used = input.quotaUsed;
  const sent: PlannedNotice[] = [];
  const failed: PlannedNotice[] = [];
  const unrecorded: PlannedNotice[] = [];
  let attempts = 0;
  const notices: PlannedNotice[] = [
    ...plan.updated.map((item) => ({ ...item, type: "URL_UPDATED" as const })),
    ...plan.deleted.map((item) => ({ url: item.url, jobId: item.jobId, type: "URL_DELETED" as const, fingerprint: item.fingerprint })),
  ];
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
      else sent.push(notice);
    }
  } finally {
    await input.release?.();
  }
  return { dryRun: false, aborted: null, plan, sent, failed, unrecorded, attempts };
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
