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

type LiveStamp = {
  timestamp?: number | null;
  publishedAt?: string | null;
  createdAt?: string | null;
  published_at?: string | null;
  created_at?: string | null;
};

function instantMs(value?: string | number | null): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === "string" && value.trim()) {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

/** Same window as the board query: posted time, publish time, or row creation. */
export function isLiveBoardJob(job: LiveStamp, now = Date.now()): boolean {
  const cutoff = liveBoardCutoffMs(now);
  return [job.timestamp, job.publishedAt, job.published_at, job.createdAt, job.created_at].some((value) => {
    const ms = instantMs(value);
    return ms != null && ms >= cutoff;
  });
}
