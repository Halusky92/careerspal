import type { SupabaseClient } from "@supabase/supabase-js";
import { applyUrlLooksSourcedAts, applyUrlLooksUsable, isSourcedOrigin, probeApplyUrl, shouldSkipLiveProbe } from "./applyLinkHealth";

type LiveJob = {
  id: string;
  title: string | null;
  apply_url: string | null;
  origin?: string | null;
  plan_price?: number | null;
  stripe_payment_status?: string | null;
  status: string | null;
};

export type SweepDeadApplyLinksResult = {
  scanned: number;
  checked: number;
  closed: number;
  deleted: number;
  skipped: number;
  dryRun: boolean;
  samples: Array<{ id: string; title: string; reason: string }>;
};

/** ATS listings are closed by the board check, not by one failed Apply URL probe. */
export function shouldLeaveApplyLinkToSourcing(row: {
  origin?: string | null;
  apply_url?: string | null;
  plan_price?: number | null;
  stripe_payment_status?: string | null;
}) {
  if (isSourcedOrigin(row.origin)) return true;
  if (applyUrlLooksSourcedAts(row.apply_url)) return true;
  const paid =
    (typeof row.plan_price === "number" && row.plan_price > 0) ||
    row.stripe_payment_status === "paid" ||
    row.stripe_payment_status === "founding";
  return paid;
}

export async function sweepDeadApplyLinks(
  sb: SupabaseClient<any, "public", any>,
  opts?: { dryRun?: boolean; limit?: number; offset?: number; timeoutMs?: number },
): Promise<SweepDeadApplyLinksResult> {
  const dryRun = Boolean(opts?.dryRun);
  const limit = Math.max(1, Math.min(opts?.limit || 40, 200));
  const offset = Math.max(0, opts?.offset || 0);
  const timeoutMs = opts?.timeoutMs && opts.timeoutMs > 0 ? opts.timeoutMs : 8000;

  const first = await sb
    .from("jobs")
    .select("id,title,apply_url,status,origin,plan_price,stripe_payment_status")
    .eq("status", "published")
    .order("timestamp", { ascending: true })
    .range(offset, offset + limit - 1);
  const page =
    first.error && /origin|plan_price|stripe_payment_status/i.test(first.error.message || "")
      ? await sb
          .from("jobs")
          .select("id,title,apply_url,status")
          .eq("status", "published")
          .order("timestamp", { ascending: true })
          .range(offset, offset + limit - 1)
      : first;
  if (page.error) throw new Error(page.error.message);
  const data = page.data;
  const jobs = (data || []) as LiveJob[];

  let checked = 0;
  let closed = 0;
  let skipped = 0;
  const samples: SweepDeadApplyLinksResult["samples"] = [];
  const toDelete: Array<{ id: string; title: string; reason: string }> = [];

  for (const job of jobs) {
    if (shouldLeaveApplyLinkToSourcing(job)) {
      skipped += 1;
      continue;
    }
    const applyUrl = job.apply_url || "";
    if (!applyUrlLooksUsable(applyUrl)) {
      toDelete.push({ id: job.id, title: job.title || "Untitled", reason: "missing apply link" });
      continue;
    }
    if (shouldSkipLiveProbe(applyUrl)) {
      skipped += 1;
      continue;
    }
    checked += 1;
    const probe = await probeApplyUrl(applyUrl, timeoutMs);
    if (!probe.dead) continue;
    toDelete.push({ id: job.id, title: job.title || "Untitled", reason: probe.reason });
  }

  for (const item of toDelete) {
    samples.push(item);
    if (dryRun) {
      closed += 1;
      continue;
    }
    const { error: closeError } = await sb
      .from("jobs")
      .update({ status: "closed" })
      .eq("id", item.id)
      .eq("status", "published");
    if (closeError) continue;
    closed += 1;
    await sb.from("audit_logs").insert({
      action: "dead_apply_link_closed",
      job_id: item.id,
      metadata: { title: item.title, reason: item.reason },
    });
  }

  return {
    scanned: jobs.length,
    checked,
    closed,
    deleted: closed,
    skipped,
    dryRun,
    samples: samples.slice(0, 40),
  };
}
