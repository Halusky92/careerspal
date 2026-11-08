"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSupabaseAuth } from "./Providers";
import { authFetch } from "../lib/authFetch";
import { hasSalary } from "../lib/jobs/listingFieldChecks";
import { isOnNicheJob } from "../lib/nicheScope";
import type { Job } from "../types";
import AdminInbox from "./AdminInbox";

type Stats = { users: number; jobs: number; savedJobs: number; files: number };
type Period = { totalViews: number; uniqueVisitors: number; newVisitors?: number; returningVisitors?: number };
type PageRow = { path: string; label: string; views: number };
type DailyPoint = { date: string; count: number };
type Analytics = {
  periods: { today: Period; week: Period; month: Period; all?: Period };
  pages?: { week: PageRow[]; today?: PageRow[]; month?: PageRow[] };
  dailyViews?: DailyPoint[];
  dailyPosts?: DailyPoint[];
};
type RoleSummary = { summary?: Record<string, number> };

const card = "rounded-lg border border-emerald-900/40 bg-zinc-950/80 p-4";
const ghost =
  "h-8 px-3 inline-flex items-center rounded border border-emerald-800/70 text-[11px] uppercase tracking-wide text-emerald-300 hover:bg-emerald-950";

const COMMANDS = [
  { href: "/dashboard/admin?tab=review", label: "Confirm queue" },
  { href: "/dashboard/admin?tab=jobs", label: "All listings" },
  { href: "/dashboard/admin?tab=sourcing", label: "Sourcing pipeline" },
  { href: "/dashboard/admin?tab=people", label: "Inbox" },
  { href: "/dashboard/admin?tab=more", label: "Traffic desk" },
  { href: "/dashboard/employer", label: "My listings" },
  { href: "/post-a-job", label: "Post a job" },
  { href: "/jobs", label: "Public board" },
];

const countBy = (jobs: Job[], pick: (job: Job) => string) => {
  const map = new Map<string, number>();
  jobs.forEach((job) => {
    const key = pick(job) || "—";
    map.set(key, (map.get(key) || 0) + 1);
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
};

const Spark = ({ points }: { points?: DailyPoint[] }) => {
  const values = (points || []).map((row) => row.count);
  const max = Math.max(1, ...values);
  if (!values.length) return <p className="text-xs text-zinc-500">No series yet.</p>;
  return (
    <div className="flex items-end gap-px h-16">
      {values.slice(-21).map((count, index) => (
        <div
          key={`${index}-${count}`}
          className="flex-1 bg-emerald-700/80 min-w-[3px]"
          style={{ height: `${Math.max(8, Math.round((count / max) * 100))}%` }}
          title={`${count}`}
        />
      ))}
    </div>
  );
};

const OpsConsole = () => {
  const { accessToken } = useSupabaseAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [roles, setRoles] = useState<Record<string, number>>({});
  const [jobs, setJobs] = useState<Job[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");

  const load = async () => {
    if (!accessToken) return;
    const [statsRes, jobsRes, analyticsRes, rolesRes] = await Promise.all([
      authFetch("/api/admin/stats", {}, accessToken),
      authFetch("/api/admin/jobs", {}, accessToken),
      authFetch("/api/admin/analytics", {}, accessToken),
      authFetch("/api/admin/role-summary", {}, accessToken),
    ]);
    if (statsRes.ok) setStats((await statsRes.json()) as Stats);
    if (jobsRes.ok) {
      const data = (await jobsRes.json()) as { jobs?: Job[] };
      setJobs(data.jobs || []);
    }
    if (analyticsRes.ok) setAnalytics((await analyticsRes.json()) as Analytics);
    if (rolesRes.ok) {
      const data = (await rolesRes.json()) as RoleSummary;
      setRoles(data.summary || {});
    }
  };

  useEffect(() => {
    void load();
  }, [accessToken]);

  const pending = useMemo(() => jobs.filter((job) => job.status === "pending_review"), [jobs]);
  const live = useMemo(() => jobs.filter((job) => job.status === "published"), [jobs]);
  const drafts = useMemo(() => jobs.filter((job) => job.status === "draft"), [jobs]);
  const statuses = useMemo(() => countBy(jobs, (job) => String(job.status || "unknown")), [jobs]);
  const categories = useMemo(() => countBy(live, (job) => job.category || "uncategorized"), [live]);
  const remoteMix = useMemo(() => countBy(live, (job) => job.remotePolicy || job.location || "unset"), [live]);
  const pendingSalaryGaps = pending.filter((job) => !hasSalary(job.salary)).length;
  const pendingOffNiche = pending.filter((job) => !isOnNicheJob({ title: job.title, category: job.category, description: job.description })).length;

  const setStatus = async (id: string, status: "published" | "private") => {
    if (!accessToken) return;
    setBusy(id);
    setNote("");
    const response = await authFetch(
      `/api/admin/jobs/${id}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) },
      accessToken,
    );
    setBusy("");
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setNote(data.error || "Could not update listing.");
      return;
    }
    await load();
  };

  const autoCheck = async () => {
    if (!accessToken) return;
    setBusy("auto");
    setNote("");
    const response = await authFetch("/api/admin/jobs/auto-review", { method: "POST" }, accessToken);
    setBusy("");
    setNote(response.ok ? "Queue checked." : "Auto-check failed.");
    await load();
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-zinc-950 text-zinc-200 font-mono">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-emerald-500">CareersPal · night desk</p>
            <h1 className="text-2xl text-emerald-300 mt-1">Ops console</h1>
            <p className="text-xs text-zinc-500 mt-1">Your board, traffic, and publish calls. Salary, apply, and niche still gate live listings.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/admin?tab=review" className={ghost}>Light desk</Link>
            <Link href="/dashboard/admin?tab=sourcing" className={ghost}>Pipeline</Link>
            <button type="button" onClick={() => void autoCheck()} className={ghost} disabled={busy === "auto"}>
              {busy === "auto" ? "Checking…" : "Auto-check"}
            </button>
          </div>
        </div>

        {note ? <p className="text-xs text-amber-400">{note}</p> : null}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Accounts", value: stats?.users ?? "—" },
            { label: "Listings", value: stats?.jobs ?? "—" },
            { label: "Live", value: live.length },
            { label: "In review", value: pending.length },
          ].map((item) => (
            <div key={item.label} className={card}>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">{item.label}</div>
              <div className="text-2xl text-emerald-300 mt-1">{item.value}</div>
            </div>
          ))}
        </div>

        <AdminInbox compact />

        <div className={card}>
          <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Command panel</p>
          <div className="flex flex-wrap gap-2">
            {COMMANDS.map((item) => (
              <Link key={item.href} href={item.href} className={ghost}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className={card}>
            <div className="text-[10px] uppercase tracking-widest text-zinc-500">Traffic today</div>
            <div className="text-xl text-emerald-300 mt-1">{analytics?.periods.today.totalViews ?? "—"} views</div>
            <div className="text-xs text-zinc-500">
              {analytics?.periods.today.uniqueVisitors ?? "—"} unique
              {typeof analytics?.periods.today.newVisitors === "number" ? ` · ${analytics.periods.today.newVisitors} new` : ""}
            </div>
          </div>
          <div className={card}>
            <div className="text-[10px] uppercase tracking-widest text-zinc-500">Traffic 7d</div>
            <div className="text-xl text-emerald-300 mt-1">{analytics?.periods.week.totalViews ?? "—"} views</div>
            <div className="text-xs text-zinc-500">{analytics?.periods.week.uniqueVisitors ?? "—"} unique</div>
          </div>
          <div className={card}>
            <div className="text-[10px] uppercase tracking-widest text-zinc-500">Roles</div>
            <div className="text-xs text-zinc-400 mt-2 space-y-1">
              {Object.entries(roles).map(([role, count]) => (
                <div key={role} className="flex justify-between"><span>{role}</span><span className="text-emerald-400">{count}</span></div>
              ))}
              <div className="flex justify-between"><span>drafts</span><span className="text-emerald-400">{drafts.length}</span></div>
              <div className="flex justify-between"><span>saved jobs</span><span className="text-emerald-400">{stats?.savedJobs ?? "—"}</span></div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className={card}>
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Views · last 21 days</p>
            <Spark points={analytics?.dailyViews} />
          </div>
          <div className={card}>
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-3">New listings · last 21 days</p>
            <Spark points={analytics?.dailyPosts} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className={card}>
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Listing status</p>
            <ul className="text-xs text-zinc-400 space-y-1">
              {statuses.map(([status, count]) => (
                <li key={status} className="flex justify-between"><span>{status}</span><span className="text-emerald-400">{count}</span></li>
              ))}
            </ul>
          </div>
          <div className={card}>
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Live categories</p>
            <ul className="text-xs text-zinc-400 space-y-1">
              {categories.slice(0, 8).map(([name, count]) => (
                <li key={name} className="flex justify-between"><span>{name}</span><span className="text-emerald-400">{count}</span></li>
              ))}
            </ul>
          </div>
          <div className={card}>
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Live work mode</p>
            <ul className="text-xs text-zinc-400 space-y-1">
              {remoteMix.slice(0, 8).map(([name, count]) => (
                <li key={name} className="flex justify-between gap-3"><span className="truncate">{name}</span><span className="text-emerald-400">{count}</span></li>
              ))}
            </ul>
            <p className="text-[11px] text-zinc-600 mt-3">Queue gaps: {pendingSalaryGaps} without salary · {pendingOffNiche} off-niche</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className={card}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] uppercase tracking-widest text-zinc-500">Confirm queue</p>
              <Link href="/dashboard/admin?tab=review" className="text-[11px] text-emerald-400">Open full list</Link>
            </div>
            {pending.length === 0 ? (
              <p className="text-sm text-zinc-500">Nothing waiting.</p>
            ) : (
              <ul className="space-y-2">
                {pending.slice(0, 8).map((job) => (
                  <li key={job.id} className="border border-zinc-800 rounded p-2">
                    <div className="text-sm text-zinc-100">{job.title}</div>
                    <div className="text-[11px] text-zinc-500">{job.company} · {job.salary || "no salary"} · {job.remotePolicy || job.location || "—"}</div>
                    <div className="mt-2 flex gap-2">
                      <button type="button" disabled={busy === job.id} onClick={() => void setStatus(job.id, "published")} className="h-7 px-2 rounded bg-emerald-700 text-[11px] text-white">
                        Publish
                      </button>
                      <button type="button" disabled={busy === job.id} onClick={() => void setStatus(job.id, "private")} className="h-7 px-2 rounded border border-zinc-700 text-[11px] text-zinc-300">
                        Hold
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className={card}>
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Paths this week</p>
            <ul className="space-y-1 text-xs">
              {(analytics?.pages?.week || []).slice(0, 10).map((row) => (
                <li key={row.path} className="flex justify-between gap-3 text-zinc-400">
                  <span>{row.label}</span>
                  <span className="text-emerald-400">{row.views}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OpsConsole;
