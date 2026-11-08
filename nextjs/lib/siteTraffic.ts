import { utcDateKey } from "./jobListingStats";

export type SiteDayTraffic = {
  date: string;
  visitors: number;
  views: number;
  applyClicks: number;
};

export function visitorKey(log: {
  metadata?: { ipHash?: string | null; sessionId?: string | null } | null;
}) {
  return String(log.metadata?.sessionId || log.metadata?.ipHash || "").trim();
}

export function buildDailySiteTraffic(
  viewLogs: Array<{ created_at: string; metadata?: { ipHash?: string | null; sessionId?: string | null } | null }>,
  applyLogs: Array<{ created_at: string }>,
  days = 7,
  now = new Date(),
): SiteDayTraffic[] {
  const viewMap = new Map<string, number>();
  const visitorMap = new Map<string, Set<string>>();
  for (const log of viewLogs) {
    const date = utcDateKey(log.created_at);
    if (!date) continue;
    viewMap.set(date, (viewMap.get(date) || 0) + 1);
    const key = visitorKey(log);
    if (!key) continue;
    const set = visitorMap.get(date) || new Set<string>();
    set.add(key);
    visitorMap.set(date, set);
  }
  const applyMap = new Map<string, number>();
  for (const log of applyLogs) {
    const date = utcDateKey(log.created_at);
    if (!date) continue;
    applyMap.set(date, (applyMap.get(date) || 0) + 1);
  }
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const points: SiteDayTraffic[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(start.getTime() - i * 24 * 60 * 60 * 1000);
    const date = utcDateKey(day);
    points.push({
      date,
      visitors: visitorMap.get(date)?.size || 0,
      views: viewMap.get(date) || 0,
      applyClicks: applyMap.get(date) || 0,
    });
  }
  return points;
}
