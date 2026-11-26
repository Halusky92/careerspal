import { supabaseAdmin } from "../supabaseAdmin";
import { recordWithRetry } from "./run";
import type { PublishResult } from "./client";
import type { PlannedNotice } from "./run";

export async function recordIndexNotice(notice: PlannedNotice, result: PublishResult): Promise<boolean> {
  if (!supabaseAdmin) return false;
  const db = supabaseAdmin;
  return recordWithRetry(async () => {
    const saved = await db.from("google_index_notifications").insert({
      url: notice.url,
      job_id: notice.jobId,
      notice_type: notice.type,
      fingerprint: notice.fingerprint,
      http_status: result.status || null,
      attempts: result.attempts,
      state: result.ok ? "sent" : "failed",
      last_error: result.ok ? null : result.error,
      sent_at: result.ok ? new Date().toISOString() : null,
      notify_time: result.notifyTime || null,
      confirmed: Boolean(result.notifyTime),
    });
    return !saved.error;
  });
}

export async function claimIndexingLock(owner: string): Promise<boolean> {
  if (!supabaseAdmin) return false;
  const result = await supabaseAdmin.rpc("google_index_claim", { lease_owner: owner, seconds: 50 });
  return !result.error && result.data === true;
}

export async function releaseIndexingLock(owner: string): Promise<void> {
  if (!supabaseAdmin) return;
  await supabaseAdmin.rpc("google_index_release", { lease_owner: owner });
}
