export const PENDING_APPLY_KEY = "cp_pending_apply";

export type PendingApply = {
  jobId: string;
  applyUrl: string;
  returnTo: string;
};

export function applyLinkReady(raw?: string | null) {
  const url = String(raw || "").trim();
  return Boolean(url) && url !== "#";
}

export function stashPendingApply(pending: PendingApply) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(PENDING_APPLY_KEY, JSON.stringify(pending));
}

export function takePendingApply(): PendingApply | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PENDING_APPLY_KEY);
    sessionStorage.removeItem(PENDING_APPLY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingApply;
    if (!parsed?.jobId || !applyLinkReady(parsed.applyUrl)) return null;
    return parsed;
  } catch {
    sessionStorage.removeItem(PENDING_APPLY_KEY);
    return null;
  }
}

export function currentReturnTo() {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search || ""}` || "/";
}

export const APPLY_BLOCKED_EVENT = "cp-apply-blocked";

export function openCompanyApply(applyUrl: string) {
  if (typeof window === "undefined") return false;
  if (applyUrl.startsWith("mailto:")) {
    window.location.href = applyUrl;
    return true;
  }
  const opened = window.open(applyUrl, "_blank", "noopener,noreferrer");
  return Boolean(opened);
}

export function notifyApplyBlocked(pending: PendingApply) {
  if (typeof window === "undefined") return;
  stashPendingApply(pending);
  window.dispatchEvent(new CustomEvent(APPLY_BLOCKED_EVENT, { detail: pending }));
}

export function authHrefForApply(returnTo: string) {
  return `/auth?from=${encodeURIComponent(returnTo.startsWith("/") ? returnTo : "/")}`;
}
