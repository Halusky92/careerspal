import { createHash } from "node:crypto";
import { CANONICAL_ORIGIN } from "../alerts/siteUrl";
import { createJobSlug } from "../jobs";

export const GOOGLE_INDEXING_DEFAULT_DAILY_QUOTA = 200;
export const GOOGLE_INDEXING_PER_RUN_CAP = 40;
export const LIVE_SENDING_RELEASED = false;

export type NoticeType = "URL_UPDATED" | "URL_DELETED";
export type IndexVisibility = "job_posting" | "noindex" | "gone" | "public_without_posting";

export type IndexJobSnapshot = {
  id: string;
  title: string;
  company: string;
  location: string;
  workMode: string;
  employmentType: string;
  salaryLabel: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  salaryPeriod: string;
  applyUrl: string;
  description: string;
  contentHash: string;
  visibility: IndexVisibility;
};

export type SentNotice = {
  url: string;
  jobId: string | null;
  type: NoticeType;
  fingerprint: string;
  sentAt: string;
};

export type IndexPlan = {
  aborted: string | null;
  liveSending: false;
  totalUpdated: number;
  totalDeleted: number;
  batchUpdated: number;
  batchDeleted: number;
  deferred: number;
  skippedUnchanged: number;
  sentToday: number;
  dailyQuota: number;
  remainingQuota: number;
  updated: Array<{ url: string; jobId: string; fingerprint: string }>;
  deleted: Array<{ url: string; jobId: string | null; fingerprint: string }>;
};

export function googleIndexingLiveEnabled(): false {
  return LIVE_SENDING_RELEASED;
}

export function indexVisibility(input: {
  status?: string | null;
  onNiche: boolean;
  live: boolean;
  jobPosting: boolean;
}): IndexVisibility {
  if (input.status !== "published" || !input.onNiche) return "gone";
  if (!input.live) return "noindex";
  if (input.jobPosting) return "job_posting";
  return "public_without_posting";
}

export function canonicalJobUrl(job: Pick<IndexJobSnapshot, "id" | "title">): string {
  return `${CANONICAL_ORIGIN}/jobs/${createJobSlug({ id: job.id, title: job.title || "role" })}`;
}

export function indexFingerprint(job: IndexJobSnapshot): string {
  const payload = {
    url: canonicalJobUrl(job),
    title: job.title.trim(),
    company: job.company.trim(),
    location: job.location.trim(),
    workMode: job.workMode.trim(),
    employmentType: job.employmentType.trim(),
    salaryLabel: job.salaryLabel.trim(),
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    salaryCurrency: job.salaryCurrency.trim().toUpperCase(),
    salaryPeriod: job.salaryPeriod.trim().toLowerCase(),
    applyUrl: job.applyUrl.trim(),
    description: job.description.replace(/\s+/g, " ").trim(),
    contentHash: job.contentHash.trim(),
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function latestByUrl(history: SentNotice[]): Map<string, SentNotice> {
  const sorted = [...history].sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  const map = new Map<string, SentNotice>();
  for (const notice of sorted) map.set(notice.url, notice);
  return map;
}

function latestUpdatedByJob(history: SentNotice[]): Map<string, SentNotice[]> {
  const byJob = new Map<string, SentNotice[]>();
  for (const notice of history) {
    if (notice.type !== "URL_UPDATED" || !notice.jobId) continue;
    const rows = byJob.get(notice.jobId) || [];
    rows.push(notice);
    byJob.set(notice.jobId, rows);
  }
  for (const [jobId, rows] of byJob) {
    const latest = new Map<string, SentNotice>();
    for (const row of rows.sort((a, b) => a.sentAt.localeCompare(b.sentAt))) latest.set(row.url, row);
    byJob.set(jobId, [...latest.values()]);
  }
  return byJob;
}

export function planIndexNotifications(input: {
  jobs: IndexJobSnapshot[] | null;
  jobsReadOk: boolean;
  scanComplete: boolean;
  history: SentNotice[] | null;
  historyReadOk: boolean;
  sentToday: number;
  dailyQuota?: number;
  perRunCap?: number;
}): IndexPlan {
  const dailyQuota = input.dailyQuota && input.dailyQuota > 0 ? input.dailyQuota : GOOGLE_INDEXING_DEFAULT_DAILY_QUOTA;
  const perRunCap = input.perRunCap && input.perRunCap > 0 ? input.perRunCap : GOOGLE_INDEXING_PER_RUN_CAP;
  const sentToday = Math.max(0, input.sentToday || 0);
  const remainingQuota = Math.max(0, dailyQuota - sentToday);
  const room = Math.min(perRunCap, remainingQuota);
  const empty = {
    aborted: null as string | null,
    liveSending: false as const,
    totalUpdated: 0,
    totalDeleted: 0,
    batchUpdated: 0,
    batchDeleted: 0,
    deferred: 0,
    skippedUnchanged: 0,
    sentToday,
    dailyQuota,
    remainingQuota,
    updated: [] as IndexPlan["updated"],
    deleted: [] as IndexPlan["deleted"],
  };
  if (!input.jobsReadOk || !input.jobs || !input.scanComplete) {
    return { ...empty, aborted: "jobs_unreadable" };
  }
  if (input.jobs.length === 0 && (input.history || []).some((notice) => notice.type === "URL_UPDATED")) {
    return { ...empty, aborted: "empty_job_scan" };
  }

  const history = input.historyReadOk && input.history ? input.history : [];
  const deletesAllowed = input.historyReadOk && input.scanComplete;
  const latest = latestByUrl(history);
  const updatedUrls = new Map<string, { url: string; jobId: string; fingerprint: string }>();
  let skippedUnchanged = 0;

  for (const job of input.jobs) {
    if (job.visibility !== "job_posting") continue;
    const url = canonicalJobUrl(job);
    const fingerprint = indexFingerprint(job);
    const prev = latest.get(url);
    if (prev?.type === "URL_UPDATED" && prev.fingerprint === fingerprint) {
      skippedUnchanged += 1;
      continue;
    }
    updatedUrls.set(url, { url, jobId: job.id, fingerprint });
  }

  const deleted: IndexPlan["deleted"] = [];
  if (deletesAllowed) {
    const jobsById = new Map(input.jobs.map((job) => [job.id, job]));
    const seenDelete = new Set<string>();
    for (const notices of latestUpdatedByJob(history).values()) {
      for (const notice of notices) {
        if (latest.get(notice.url)?.type === "URL_DELETED") continue;
        const job = notice.jobId ? jobsById.get(notice.jobId) : undefined;
        const stillPosted = job?.visibility === "job_posting" && canonicalJobUrl(job) === notice.url;
        if (stillPosted) continue;
        const removed = !job || job.visibility === "gone" || job.visibility === "noindex";
        if (!removed || seenDelete.has(notice.url)) continue;
        seenDelete.add(notice.url);
        deleted.push({ url: notice.url, jobId: notice.jobId, fingerprint: notice.fingerprint });
      }
    }
  }

  const updated = [...updatedUrls.values()];
  const ordered = [
    ...updated.map((item) => ({ kind: "updated" as const, item })),
    ...deleted.map((item) => ({ kind: "deleted" as const, item })),
  ];
  const batch = ordered.slice(0, room);
  return {
    aborted: null,
    liveSending: false,
    totalUpdated: updated.length,
    totalDeleted: deleted.length,
    batchUpdated: batch.filter((item) => item.kind === "updated").length,
    batchDeleted: batch.filter((item) => item.kind === "deleted").length,
    deferred: Math.max(0, ordered.length - batch.length),
    skippedUnchanged,
    sentToday,
    dailyQuota,
    remainingQuota,
    updated: batch.filter((item) => item.kind === "updated").map((item) => item.item),
    deleted: batch.filter((item) => item.kind === "deleted").map((item) => item.item),
  };
}
