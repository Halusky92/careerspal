export const LIVE_BOARD_DAYS = 30;

export function liveBoardCutoffMs(now = Date.now()) {
  return now - LIVE_BOARD_DAYS * 24 * 60 * 60 * 1000;
}

export function liveBoardCutoffIso(now = Date.now()) {
  return new Date(liveBoardCutoffMs(now)).toISOString();
}

export function applyLiveBoardFilter<T extends { or: (filter: string) => T }>(query: T): T {
  const ms = liveBoardCutoffMs();
  const iso = liveBoardCutoffIso();
  return query.or(`timestamp.gte.${ms},published_at.gte.${iso},created_at.gte.${iso}`);
}

export function isLiveBoardJob(job: { timestamp?: number | null }): boolean {
  const ts = job.timestamp;
  if (typeof ts !== "number" || !Number.isFinite(ts)) return false;
  return ts >= liveBoardCutoffMs();
}
