import { listingSourceLabel } from "./listingTraffic";

export const LISTING_STATS_DAYS = 14;

export type DailyTraffic = {
  date: string;
  views: number;
  applyClicks: number;
};

export type TrafficSourceRow = {
  source: string;
  label: string;
  views: number;
  applyClicks: number;
};

export function utcDateKey(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function applyClickRate(views: number, applyClicks: number) {
  const uniqueViews = Math.max(0, Math.floor(Number(views) || 0));
  const clicks = Math.max(0, Math.floor(Number(applyClicks) || 0));
  if (uniqueViews <= 0) return null;
  return clicks / uniqueViews;
}

export function formatApplyClickRate(rate: number | null) {
  if (rate == null) return "—";
  return `${Math.round(rate * 100)}%`;
}

export function buildDailyTraffic(
  viewTimes: string[],
  applyTimes: string[],
  days = LISTING_STATS_DAYS,
  now = new Date(),
): DailyTraffic[] {
  const viewMap = new Map<string, number>();
  const applyMap = new Map<string, number>();
  for (const time of viewTimes) {
    const key = utcDateKey(time);
    if (!key) continue;
    viewMap.set(key, (viewMap.get(key) || 0) + 1);
  }
  for (const time of applyTimes) {
    const key = utcDateKey(time);
    if (!key) continue;
    applyMap.set(key, (applyMap.get(key) || 0) + 1);
  }
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const points: DailyTraffic[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(start.getTime() - i * 24 * 60 * 60 * 1000);
    const date = utcDateKey(day);
    points.push({
      date,
      views: viewMap.get(date) || 0,
      applyClicks: applyMap.get(date) || 0,
    });
  }
  return points;
}

export function rollupTrafficSources(
  logs: Array<{ action?: string | null; metadata?: { source?: string | null } | null }>,
): TrafficSourceRow[] {
  const map = new Map<string, TrafficSourceRow>();
  for (const log of logs) {
    const source = String(log.metadata?.source || "direct").slice(0, 32);
    const row = map.get(source) || {
      source,
      label: listingSourceLabel(source),
      views: 0,
      applyClicks: 0,
    };
    if (log.action === "view") row.views += 1;
    else if (log.action === "apply_click" || log.action === "match") row.applyClicks += 1;
    map.set(source, row);
  }
  return Array.from(map.values()).sort(
    (a, b) => b.views + b.applyClicks - (a.views + a.applyClicks),
  );
}
