import { supabaseAdmin } from "../supabaseAdmin";
import { isEarlyAccessListing } from "../listingWindow";
import { descriptionSha, type SentNotice } from "./plan";
import { quotaAttempts } from "./quota";
import {
  SLIM_JOB_SELECT,
  deltaRows,
  descriptionIdsForRun,
  digestIsCurrent,
  type IndexDigest,
  type SlimIndexRow,
} from "./select";
import { toIndexSnapshot, type IndexJobRow } from "./snapshot";
import type { IndexJobSnapshot } from "./plan";

type DbError = { code?: string; message?: string } | null;

function missingRelation(error: DbError): boolean {
  if (!error) return false;
  const code = error.code || "";
  const message = error.message || "";
  return code === "42P01" || code === "PGRST205" || code === "PGRST202" || /google_index_digest|schema cache/i.test(message);
}

async function loadSlim(): Promise<{ rows: SlimIndexRow[] | null; complete: boolean }> {
  if (!supabaseAdmin) return { rows: null, complete: false };
  const rows: SlimIndexRow[] = [];
  let offset = 0;
  while (offset <= 20000) {
    const page = await supabaseAdmin.from("jobs").select(SLIM_JOB_SELECT).range(offset, offset + 199);
    if (page.error) return { rows: null, complete: false };
    const chunk = (page.data || []) as SlimIndexRow[];
    rows.push(...chunk);
    if (chunk.length < 200) return { rows, complete: true };
    offset += 200;
  }
  return { rows: null, complete: false };
}

async function loadDigest(): Promise<{ digests: Map<string, IndexDigest>; available: boolean; ok: boolean }> {
  const digests = new Map<string, IndexDigest>();
  if (!supabaseAdmin) return { digests, available: false, ok: false };
  let offset = 0;
  while (offset <= 20000) {
    const page = await supabaseAdmin
      .from("google_index_digest")
      .select("job_id,updated_at,content_hash,description_sha,visibility,early")
      .range(offset, offset + 499);
    if (page.error) {
      if (missingRelation(page.error)) return { digests, available: false, ok: true };
      return { digests, available: false, ok: false };
    }
    const chunk = page.data || [];
    for (const row of chunk) {
      if (!row.job_id || !row.description_sha || !row.visibility) continue;
      digests.set(row.job_id, {
        jobId: row.job_id,
        updatedAt: row.updated_at || "",
        contentHash: row.content_hash || "",
        descriptionSha: row.description_sha,
        visibility: row.visibility,
        early: Boolean(row.early),
      });
    }
    if (chunk.length < 500) return { digests, available: true, ok: true };
    offset += 500;
  }
  return { digests, available: true, ok: true };
}

async function loadHistory(now: Date): Promise<{ notices: SentNotice[] | null; quotaUsed: number; ok: boolean; reason: string | null }> {
  if (!supabaseAdmin) return { notices: null, quotaUsed: 0, ok: false, reason: "notifications_unreadable" };
  const notices: SentNotice[] = [];
  const quotaRows: Array<{ attempts?: number | null; createdAt?: string | null }> = [];
  let offset = 0;
  while (offset <= 20000) {
    const page = await supabaseAdmin
      .from("google_index_notifications")
      .select("url,job_id,notice_type,fingerprint,state,attempts,sent_at,created_at")
      .order("created_at", { ascending: true })
      .range(offset, offset + 499);
    if (page.error) {
      const code = page.error.code || "";
      const message = page.error.message || "";
      const missing = code === "42P01" || code === "PGRST205" || /google_index_notifications|schema cache/i.test(message);
      return { notices: null, quotaUsed: 0, ok: false, reason: missing ? "notifications_table_missing" : "notifications_unreadable" };
    }
    const chunk = page.data || [];
    for (const row of chunk) {
      quotaRows.push({ attempts: row.attempts, createdAt: row.created_at });
      if (row.state !== "sent" || !row.url || (row.notice_type !== "URL_UPDATED" && row.notice_type !== "URL_DELETED")) continue;
      notices.push({
        url: row.url,
        jobId: row.job_id || null,
        type: row.notice_type,
        fingerprint: row.fingerprint || "",
        sentAt: row.sent_at || row.created_at || "",
      });
    }
    if (chunk.length < 500) break;
    offset += 500;
  }
  return { notices, quotaUsed: quotaAttempts(quotaRows, now), ok: true, reason: null };
}

function withDigest(row: SlimIndexRow, digest: IndexDigest): IndexJobSnapshot {
  const snapshot = toIndexSnapshot({ ...row, description: "" });
  return { ...snapshot, description: "", descriptionSha: digest.descriptionSha, visibility: digest.visibility };
}

export async function prepareIndexing(input: { now: Date; descriptionCap: number; delta: boolean }): Promise<{
  jobs: IndexJobSnapshot[] | null;
  jobsReadOk: boolean;
  scanComplete: boolean;
  history: SentNotice[] | null;
  historyReadOk: boolean;
  quotaUsed: number;
  historyReason: string | null;
  descriptionsRead: number;
  digestAvailable: boolean;
}> {
  const loaded = await loadSlim();
  if (!loaded.complete || !loaded.rows) {
    return {
      jobs: null,
      jobsReadOk: false,
      scanComplete: false,
      history: null,
      historyReadOk: false,
      quotaUsed: 0,
      historyReason: "jobs_unreadable",
      descriptionsRead: 0,
      digestAvailable: false,
    };
  }
  const digest = await loadDigest();
  if (!digest.ok) {
    return {
      jobs: null,
      jobsReadOk: false,
      scanComplete: false,
      history: null,
      historyReadOk: false,
      quotaUsed: 0,
      historyReason: "digest_unreadable",
      descriptionsRead: 0,
      digestAvailable: false,
    };
  }
  const nowMs = input.now.getTime();
  const pool = input.delta ? deltaRows(loaded.rows, digest.digests, nowMs) : loaded.rows;
  const needed = descriptionIdsForRun(pool, digest.digests, nowMs, 1_000_000);
  const ids = needed.slice(0, input.descriptionCap);
  const descriptions = new Map<string, string>();
  if (ids.length && supabaseAdmin) {
    const page = await supabaseAdmin.from("jobs").select("id,description").in("id", ids);
    if (page.error) {
      return {
        jobs: null,
        jobsReadOk: false,
        scanComplete: false,
        history: null,
        historyReadOk: false,
        quotaUsed: 0,
        historyReason: "jobs_unreadable",
        descriptionsRead: 0,
        digestAvailable: digest.available,
      };
    }
    for (const row of page.data || []) descriptions.set(row.id, row.description || "");
  }
  const jobs: IndexJobSnapshot[] = [];
  const digestWrites: Array<Record<string, unknown>> = [];
  for (const row of pool) {
    const saved = digest.digests.get(row.id);
    const fetched = descriptions.get(row.id);
    if (fetched == null && digestIsCurrent(row, saved, nowMs)) {
      jobs.push(withDigest(row, saved as IndexDigest));
      continue;
    }
    if (fetched == null && needed.includes(row.id)) continue;
    const snapshot = toIndexSnapshot({ ...row, description: fetched || "" } as IndexJobRow);
    if (fetched != null) {
      snapshot.descriptionSha = descriptionSha(fetched);
      digestWrites.push({
        job_id: row.id,
        updated_at: row.updated_at || null,
        content_hash: row.content_hash || "",
        description_sha: snapshot.descriptionSha,
        visibility: snapshot.visibility,
        early: isEarlyAccessListing({
          timestamp: row.timestamp,
          publishedAt: row.published_at,
          published_at: row.published_at,
          createdAt: row.created_at,
          created_at: row.created_at,
        }, nowMs),
        checked_at: input.now.toISOString(),
      });
    }
    jobs.push(snapshot);
  }
  if (digest.available && digestWrites.length && supabaseAdmin) {
    const saved = await supabaseAdmin.from("google_index_digest").upsert(digestWrites, { onConflict: "job_id" });
    if (saved.error && !missingRelation(saved.error)) {
      return {
        jobs: null,
        jobsReadOk: false,
        scanComplete: false,
        history: null,
        historyReadOk: false,
        quotaUsed: 0,
        historyReason: "digest_unreadable",
        descriptionsRead: descriptions.size,
        digestAvailable: true,
      };
    }
  }
  const history = await loadHistory(input.now);
  const evaluatedAll = !input.delta && ids.length === needed.length;
  return {
    jobs,
    jobsReadOk: true,
    scanComplete: evaluatedAll && history.ok,
    history: history.notices,
    historyReadOk: history.ok,
    quotaUsed: history.quotaUsed,
    historyReason: history.reason,
    descriptionsRead: descriptions.size,
    digestAvailable: digest.available,
  };
}
