import type { SupabaseClient } from "@supabase/supabase-js";
import { sourcingDayKey } from "./pipeline/slice";

export const LIVENESS_DAY_ACTION = "sourcing_liveness_day";
export const LIVENESS_RUNNING_STALE_MS = 15 * 60 * 1000;

export type LivenessMark = { status?: string | null; createdAt?: string | null };

/** A finished Bratislava day is skipped. A fresh running mark is left alone. */
export function livenessClaimDecision(
  existing: LivenessMark | null,
  now: Date,
  staleMs = LIVENESS_RUNNING_STALE_MS,
): "run" | "skip" {
  if (!existing) return "run";
  if (existing.status === "done") return "skip";
  if (existing.status !== "running") return "run";
  const age = now.getTime() - Date.parse(existing.createdAt || "");
  if (!Number.isFinite(age) || age >= staleMs) return "run";
  return "skip";
}

type LivenessRow = { id: string; created_at: string; metadata?: { status?: string } | null };

function newer(left: LivenessRow, right: LivenessRow) {
  if (left.created_at !== right.created_at) return left.created_at > right.created_at;
  return left.id > right.id;
}

async function latestLiveness(sb: SupabaseClient, day: string): Promise<LivenessRow | null> {
  const found = await sb
    .from("audit_logs")
    .select("id, created_at, metadata")
    .eq("action", LIVENESS_DAY_ACTION)
    .contains("metadata", { day })
    .order("created_at", { ascending: false })
    .limit(5);
  if (found.error) throw new Error(found.error.message || "Unable to read the liveness day.");
  const rows = (found.data || []) as LivenessRow[];
  return rows.sort((a, b) => (newer(a, b) ? -1 : 1))[0] || null;
}

/** One cleanup per Bratislava day. A second scheduled run, even if it starts first, does not repeat it. */
export async function claimDailyLiveness(
  sb: SupabaseClient,
  now = new Date(),
): Promise<{ action: "run"; id: string } | { action: "skip" }> {
  const day = sourcingDayKey(now);
  const existing = await latestLiveness(sb, day);
  if (livenessClaimDecision(existing ? { status: existing.metadata?.status, createdAt: existing.created_at } : null, now) === "skip") {
    return { action: "skip" };
  }
  const inserted = await sb
    .from("audit_logs")
    .insert({ actor_id: null, action: LIVENESS_DAY_ACTION, metadata: { day, status: "running" } })
    .select("id, created_at")
    .single();
  if (inserted.error || !inserted.data?.id) throw new Error(inserted.error?.message || "Unable to claim liveness.");
  const winner = await latestLiveness(sb, day);
  if (!winner || winner.id !== inserted.data.id) {
    try {
      await finishDailyLiveness(sb, inserted.data.id, "failed");
    } catch {
      /* The newer claim owns the day. */
    }
    return { action: "skip" };
  }
  return { action: "run", id: inserted.data.id };
}

export async function finishDailyLiveness(sb: SupabaseClient, id: string, status: "done" | "failed") {
  const current = await sb.from("audit_logs").select("metadata").eq("id", id).maybeSingle();
  if (current.error) throw new Error(current.error.message || "Unable to finish liveness.");
  const metadata = { ...((current.data?.metadata as Record<string, unknown> | null) || {}), status };
  const updated = await sb.from("audit_logs").update({ metadata }).eq("id", id);
  if (updated.error) throw new Error(updated.error.message || "Unable to finish liveness.");
}
