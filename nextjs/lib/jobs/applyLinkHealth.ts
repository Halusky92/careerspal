import { isSourcedJobOrigin } from "../sourcing/origin";

export const CLOSED_APPLY_PHRASES = [
  "job not found",
  "this job is no longer available",
  "no longer available",
  "no longer accepting applications",
  "position has been filled",
  "role has been filled",
  "job has expired",
  "opportunity is closed",
  "this position has been closed",
  "the job posting you were looking for does not exist",
  "this job is closed",
  "sorry, this job has been filled",
  "page not found",
];

export function applyUrlLooksUsable(raw?: string | null) {
  const value = (raw || "").trim();
  if (!value || value === "#") return false;
  if (value.startsWith("mailto:") && value.includes("@")) return true;
  if (value.includes("@") && !value.includes(" ") && !value.includes("://")) return true;
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function shouldSkipLiveProbe(raw?: string | null) {
  const value = (raw || "").trim();
  if (!applyUrlLooksUsable(value)) return true;
  if (value.startsWith("mailto:")) return true;
  if (value.includes("@") && !value.includes("://")) return true;
  return false;
}

export function normalizeApplyHttpUrl(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
}

export function isClosedApplyCopy(text: string) {
  const normalized = text.toLowerCase();
  return CLOSED_APPLY_PHRASES.some((phrase) => normalized.includes(phrase));
}

export type ApplyProbeResult = {
  ok: boolean;
  dead: boolean;
  reason: string;
};

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: "follow" });
  } finally {
    clearTimeout(timeout);
  }
}

export function applyProbeFromStatus(status: number): ApplyProbeResult | null {
  if (status === 404 || status === 410) return { ok: false, dead: true, reason: `status ${status}` };
  if (status === 401 || status === 403 || status === 408 || status === 429) {
    return { ok: true, dead: false, reason: `temporary ${status}` };
  }
  if (status >= 500) return { ok: true, dead: false, reason: `status ${status}` };
  return null;
}

export function applyProbeFromFetchError(message: string): ApplyProbeResult {
  const text = message.toLowerCase();
  if (text.includes("enotfound") || text.includes("getaddrinfo") || text.includes("err_name_not_resolved")) {
    return { ok: false, dead: true, reason: "host missing" };
  }
  return { ok: true, dead: false, reason: "fetch error" };
}

export async function probeApplyUrl(raw: string, timeoutMs = 10000): Promise<ApplyProbeResult> {
  if (shouldSkipLiveProbe(raw)) {
    return { ok: applyUrlLooksUsable(raw), dead: !applyUrlLooksUsable(raw), reason: applyUrlLooksUsable(raw) ? "skip" : "missing" };
  }
  const url = normalizeApplyHttpUrl(raw);
  try {
    const head = await fetchWithTimeout(url, { method: "HEAD" }, Math.min(8000, timeoutMs));
    const headProbe = applyProbeFromStatus(head.status);
    if (headProbe && /temporary/.test(headProbe.reason)) return headProbe;
  } catch {
    // HEAD is often blocked; GET is the source of truth.
  }

  try {
    const response = await fetchWithTimeout(url, { method: "GET", headers: { "user-agent": "CareersPalBoard/1.0" } }, timeoutMs);
    const statusProbe = applyProbeFromStatus(response.status);
    if (statusProbe?.dead || (statusProbe && /temporary|status /.test(statusProbe.reason))) return statusProbe;
    const text = (await response.text()).slice(0, 80000);
    if (isClosedApplyCopy(text)) {
      return { ok: false, dead: true, reason: "closed copy" };
    }
    return { ok: true, dead: false, reason: "ok" };
  } catch (error) {
    return applyProbeFromFetchError(error instanceof Error ? error.message : "");
  }
}

export function isSourcedOrigin(origin?: string | null) {
  return isSourcedJobOrigin(origin);
}

export function applyUrlLooksSourcedAts(raw?: string | null) {
  const value = (raw || "").toLowerCase();
  if (!value) return false;
  return (
    value.includes("greenhouse.io") ||
    value.includes("ashbyhq.com") ||
    value.includes("jobs.lever.co") ||
    value.includes("lever.co/")
  );
}

export function isSourcedListing(row: {
  id?: string | null;
  origin?: string | null;
  apply_url?: string | null;
  plan_price?: number | null;
  stripe_payment_status?: string | null;
  sourcedJobIds?: Set<string>;
}) {
  if (isSourcedOrigin(row.origin)) return true;
  if (row.origin && !isSourcedOrigin(row.origin)) return false;
  if (row.id && row.sourcedJobIds?.has(row.id) && applyUrlLooksSourcedAts(row.apply_url)) return true;
  const paid =
    (typeof row.plan_price === "number" && row.plan_price > 0) ||
    row.stripe_payment_status === "paid" ||
    row.stripe_payment_status === "founding";
  if (paid) return false;
  return applyUrlLooksSourcedAts(row.apply_url) && (row.plan_price == null);
}
