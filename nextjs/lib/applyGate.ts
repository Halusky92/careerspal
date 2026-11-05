export const PENDING_APPLY_KEY = "cp_pending_apply";
export const APPLY_CONTINUE_PATH = "/apply/continue";
export const APPLY_BLOCKED_EVENT = "cp-apply-blocked";
const PENDING_APPLY_MAX_MS = 30 * 60 * 1000;

export type PendingApply = {
  jobId: string;
  applyUrl: string;
  returnTo: string;
  at?: number;
};

export function applyLinkReady(raw?: string | null) {
  const url = String(raw || "").trim();
  return Boolean(url) && url !== "#";
}

function readPendingRaw(): PendingApply | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PENDING_APPLY_KEY) || sessionStorage.getItem(PENDING_APPLY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingApply;
    if (!parsed?.jobId || !applyLinkReady(parsed.applyUrl)) return null;
    if (parsed.at && Date.now() - parsed.at > PENDING_APPLY_MAX_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearPendingStore() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(PENDING_APPLY_KEY);
    sessionStorage.removeItem(PENDING_APPLY_KEY);
  } catch {
    // ignore
  }
}

export function stashPendingApply(pending: PendingApply) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({ ...pending, at: Date.now() });
  try {
    localStorage.setItem(PENDING_APPLY_KEY, payload);
  } catch {
    // ignore
  }
  try {
    sessionStorage.setItem(PENDING_APPLY_KEY, payload);
  } catch {
    // ignore
  }
}

export function peekPendingApply(): PendingApply | null {
  return readPendingRaw();
}

export function takePendingApply(): PendingApply | null {
  const pending = readPendingRaw();
  clearPendingStore();
  return pending;
}

export function currentReturnTo() {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search || ""}` || "/";
}

export function openCompanyApply(applyUrl: string) {
  if (typeof window === "undefined") return false;
  if (applyUrl.startsWith("mailto:")) {
    window.location.href = applyUrl;
    return true;
  }
  const opened = window.open(applyUrl, "_blank", "noopener,noreferrer");
  return Boolean(opened);
}

export function openApplyContinueTab() {
  if (typeof window === "undefined") return false;
  const opened = window.open(APPLY_CONTINUE_PATH, "_blank", "noopener,noreferrer");
  return Boolean(opened);
}

export function goToCompanyApply(applyUrl: string) {
  if (typeof window === "undefined") return;
  if (applyUrl.startsWith("mailto:")) {
    window.location.href = applyUrl;
    return;
  }
  window.location.replace(applyUrl);
}

export function notifyApplyBlocked(pending: PendingApply) {
  if (typeof window === "undefined") return;
  stashPendingApply(pending);
  window.dispatchEvent(new CustomEvent(APPLY_BLOCKED_EVENT, { detail: pending }));
}

export function authHrefForApply(returnTo: string) {
  return `/auth?from=${encodeURIComponent(returnTo.startsWith("/") ? returnTo : "/")}`;
}
