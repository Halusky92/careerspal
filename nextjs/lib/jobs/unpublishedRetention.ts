import { PLAN_PRICES } from "../plans";

/** Unpublished listings are kept this long so employers can pay to renew. Then they are deleted. */
export const UNPUBLISHED_RETENTION_DAYS = 90;

export const UNPUBLISHED_PURGE_STATUSES = [
  "draft",
  "pending_review",
  "paused",
  "closed",
  "archived",
  "private",
  "invite_only",
] as const;

export const RENEWABLE_STATUSES = new Set(["paused", "closed", "archived"]);

export const RENEW_PLAN_NAME = "Standard";
export const RENEW_PRICE = PLAN_PRICES.standard;

export type UnpublishedAgeRow = {
  status?: string | null;
  timestamp?: number | null;
  created_at?: string | null;
  published_at?: string | null;
  unpublished_at?: string | null;
};

function toMs(iso?: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function timestampMs(value?: number | null): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return value < 1e12 ? value * 1000 : value;
}

/** When the listing left the live board, or when it was created if it never went live. */
export function unpublishedSinceMs(row: UnpublishedAgeRow, now = Date.now()): number | null {
  const unpublished = toMs(row.unpublished_at);
  if (unpublished != null) return unpublished;
  if (row.status === "draft" || row.status === "pending_review") {
    return toMs(row.created_at) ?? timestampMs(row.timestamp);
  }
  return toMs(row.published_at) ?? timestampMs(row.timestamp) ?? toMs(row.created_at);
}

export function unpublishedAgeMs(row: UnpublishedAgeRow, now = Date.now()): number | null {
  const since = unpublishedSinceMs(row, now);
  if (since == null) return null;
  return now - since;
}

export function isPastUnpublishedRetention(row: UnpublishedAgeRow, now = Date.now()): boolean {
  const age = unpublishedAgeMs(row, now);
  if (age == null) return false;
  return age >= UNPUBLISHED_RETENTION_DAYS * 24 * 60 * 60 * 1000;
}

export function canRenewUnpublished(row: UnpublishedAgeRow, now = Date.now()): boolean {
  const status = String(row.status || "");
  if (!RENEWABLE_STATUSES.has(status)) return false;
  return !isPastUnpublishedRetention(row, now);
}
