import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../lib/supabaseServerAuth";
import { utcDateKey } from "../../../../lib/jobListingStats";
import { buildDailySiteTraffic, visitorKey } from "../../../../lib/siteTraffic";
import { countConfirmedAlertRecipients } from "../../../../lib/countAlertSubscribers";

export const runtime = "nodejs";

type ViewLog = {
  created_at: string;
  metadata?: { ipHash?: string | null; path?: string | null; sessionId?: string | null } | null;
};

const pageBucket = (raw?: string | null) => {
  const path = (raw || "/").split("?")[0] || "/";
  if (path === "/") return { key: "/", label: "Home" };
  if (path === "/jobs") return { key: "/jobs", label: "Jobs board" };
  if (path.startsWith("/jobs/")) return { key: "/jobs/*", label: "Job pages" };
  if (path === "/companies") return { key: "/companies", label: "Companies" };
  if (path.startsWith("/companies/")) return { key: "/companies/*", label: "Company pages" };
  if (path === "/people") return { key: "/people", label: "People" };
  if (path.startsWith("/p/")) return { key: "/p/*", label: "Seeker profiles" };
  if (path.startsWith("/alerts")) return { key: "/alerts", label: "Alerts" };
  if (path.startsWith("/account")) return { key: "/account", label: "Account" };
  if (path.startsWith("/post-a-job") || path.startsWith("/checkout")) return { key: "/post-a-job", label: "Post a job" };
  if (path.startsWith("/dashboard")) return { key: "/dashboard", label: "Dashboards" };
  if (path.startsWith("/pricing") || path.startsWith("/hire")) return { key: "/hire", label: "Pricing / hire" };
  return { key: path, label: path };
};

const countPages = (logs: ViewLog[]) => {
  const map = new Map<string, { label: string; views: number }>();
  logs.forEach((log) => {
    const bucket = pageBucket(log.metadata?.path);
    const prev = map.get(bucket.key) || { label: bucket.label, views: 0 };
    prev.views += 1;
    map.set(bucket.key, prev);
  });
  return [...map.entries()]
    .map(([key, value]) => ({ path: key, label: value.label, views: value.views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 12);
};

const fetchActionLogs = async (action: string, fromIso: string) => {
  if (!supabaseAdmin) return [];
  const pageSize = 1000;
  let offset = 0;
  const logs: Array<{ created_at: string; metadata?: ViewLog["metadata"] }> = [];
  while (true) {
    const { data } = await supabaseAdmin
      .from("audit_logs")
      .select("created_at,metadata")
      .eq("action", action)
      .gte("created_at", fromIso)
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (!data || data.length === 0) break;
    logs.push(...(data as ViewLog[]));
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return logs;
};

const uniqueIn = (logs: ViewLog[]) => {
  const keys = logs.map(visitorKey).filter(Boolean);
  return new Set(keys).size;
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
  const todayKey = utcDateKey(now);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 29 * 24 * 60 * 60 * 1000);

  const fromIso = monthStart.toISOString();
  const [
    monthLogs,
    applyLogs,
    matchLogs,
    subscribers,
    signupStarted,
    signupCompleted,
    searchLimit,
    premiumClick,
    checkoutStarted,
    checkoutPaid,
    boardPaid,
  ] = await Promise.all([
    fetchActionLogs("page_view", fromIso),
    fetchActionLogs("apply_click", fromIso),
    fetchActionLogs("match", fromIso),
    countConfirmedAlertRecipients(),
    fetchActionLogs("signup_started", fromIso),
    fetchActionLogs("signup_completed", fromIso),
    fetchActionLogs("search_limit_reached", fromIso),
    fetchActionLogs("premium_click", fromIso),
    fetchActionLogs("checkout_started", fromIso),
    fetchActionLogs("checkout_paid", fromIso),
    fetchActionLogs("board_access_paid", fromIso),
  ]);
  const applyCombined = [...applyLogs, ...matchLogs];
  const weekDays = buildDailySiteTraffic(monthLogs, applyCombined, 7, now);
  const todayLogs = monthLogs.filter((log) => utcDateKey(log.created_at) === todayKey);
  const weekLogs = monthLogs.filter((log) => weekDays.some((day) => day.date === utcDateKey(log.created_at)));
  const todayApplies = applyCombined.filter((log) => utcDateKey(log.created_at) === todayKey).length;
  const weekApplies = weekDays.reduce((sum, day) => sum + day.applyClicks, 0);
  const monthApplies = applyCombined.length;

  const periods = {
    today: {
      totalViews: todayLogs.length,
      uniqueVisitors: uniqueIn(todayLogs),
      applyClicks: todayApplies,
      newVisitors: uniqueIn(todayLogs),
      returningVisitors: 0,
    },
    week: {
      totalViews: weekLogs.length,
      uniqueVisitors: uniqueIn(weekLogs),
      applyClicks: weekApplies,
      newVisitors: uniqueIn(weekLogs),
      returningVisitors: 0,
    },
    month: {
      totalViews: monthLogs.length,
      uniqueVisitors: uniqueIn(monthLogs),
      applyClicks: monthApplies,
      newVisitors: uniqueIn(monthLogs),
      returningVisitors: 0,
    },
    all: {
      totalViews: monthLogs.length,
      uniqueVisitors: uniqueIn(monthLogs),
      applyClicks: monthApplies,
      newVisitors: 0,
      returningVisitors: 0,
    },
  };

  return NextResponse.json({
    periods,
    weekDays,
    subscribers,
    funnel: {
      signupStarted: signupStarted.length,
      signupCompleted: signupCompleted.length,
      searchLimitReached: searchLimit.length,
      premiumClick: premiumClick.length,
      checkoutStarted: checkoutStarted.length,
      checkoutPaid: checkoutPaid.length,
      boardAccessPaid: boardPaid.length,
    },
    pages: {
      today: countPages(todayLogs),
      week: countPages(weekLogs),
      month: countPages(monthLogs),
    },
  });
}
