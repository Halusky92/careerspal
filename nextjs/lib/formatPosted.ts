const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function toMillis(timestamp: number): number {
  return timestamp < 1e12 ? timestamp * 1000 : timestamp;
}

/** Locale-stable calendar date so SSR and the browser never disagree. */
export function formatShortPostedDate(timestamp: number): string {
  const date = new Date(toMillis(timestamp));
  if (Number.isNaN(date.getTime())) return "";
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

export function formatRelativePosted(timestamp?: number | null, fallback = ""): string {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return fallback;
  const ms = toMillis(timestamp);
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return fallback;
  const diffMs = Date.now() - ms;
  if (!Number.isFinite(diffMs) || diffMs < 0) return fallback || formatShortPostedDate(ms);
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatShortPostedDate(ms);
}
