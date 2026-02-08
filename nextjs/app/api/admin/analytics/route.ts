import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../lib/supabaseServerAuth";

export const runtime = "nodejs";

type ViewLog = {
  created_at: string;
  metadata?: { ipHash?: string | null } | null;
};

type DailyPoint = { date: string; count: number };

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getDateKey = (value: string | Date) => {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
};

const buildDailyCounts = (logs: Array<{ created_at: string }>, days: number): DailyPoint[] => {
  const map = new Map<string, number>();
  logs.forEach((log) => {
    const key = getDateKey(log.created_at);
    map.set(key, (map.get(key) || 0) + 1);
  });
  const today = startOfDay(new Date());
  const points: DailyPoint[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const key = getDateKey(day);
    points.push({ date: key, count: map.get(key) || 0 });
  }
  return points;
};

const fetchLogs = async (fromIso?: string) => {
  if (!supabaseAdmin) return [];
  const pageSize = 1000;
  let offset = 0;
  const logs: ViewLog[] = [];

  while (true) {
    let query = supabaseAdmin
      .from("audit_logs")
      .select("created_at,metadata")
      .eq("action", "page_view")
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (fromIso) query = query.gte("created_at", fromIso);

    const { data } = await query;
    if (!data || data.length === 0) break;
    logs.push(...(data as ViewLog[]));
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return logs;
};

export async function GET(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(todayStart.getTime() - 29 * 24 * 60 * 60 * 1000);

  const monthLogs = await fetchLogs(monthStart.toISOString());
  const allLogs = await fetchLogs();

  const getPeriodStats = (start: Date, logs: ViewLog[]) => {
    const periodLogs = logs.filter((log) => new Date(log.created_at) >= start);
    const uniques = new Set(periodLogs.map((log) => log.metadata?.ipHash).filter(Boolean) as string[]);
    const firstSeen = new Map<string, string>();
    allLogs.forEach((log) => {
      const hash = log.metadata?.ipHash;
      if (!hash) return;
      if (!firstSeen.has(hash)) firstSeen.set(hash, log.created_at);
    });
    let newCount = 0;
    uniques.forEach((hash) => {
      const seenAt = firstSeen.get(hash);
      if (seenAt && new Date(seenAt) >= start) newCount += 1;
    });
    return {
      totalViews: periodLogs.length,
      uniqueVisitors: uniques.size,
      newVisitors: newCount,
      returningVisitors: Math.max(uniques.size - newCount, 0),
    };
  };

  const allUniques = new Set(allLogs.map((log) => log.metadata?.ipHash).filter(Boolean) as string[]);
  const periods = {
    today: getPeriodStats(todayStart, monthLogs),
    week: getPeriodStats(weekStart, monthLogs),
    month: getPeriodStats(monthStart, monthLogs),
    all: {
      totalViews: allLogs.length,
      uniqueVisitors: allUniques.size,
      newVisitors: 0,
      returningVisitors: 0,
    },
  };

  const dailyViews = buildDailyCounts(monthLogs, 30);

  const { data: jobs } = await supabaseAdmin
    .from("jobs")
    .select("created_at")
    .gte("created_at", monthStart.toISOString());
  const dailyPosts = buildDailyCounts((jobs || []) as Array<{ created_at: string }>, 30);

  return NextResponse.json({
    periods,
    dailyViews,
    dailyPosts,
  });
}
