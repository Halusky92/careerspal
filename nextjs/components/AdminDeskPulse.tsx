"use client";

import { useState } from "react";
import type { SiteDayTraffic } from "../lib/siteTraffic";
import { authFetch } from "../lib/authFetch";

function weekday(date: string) {
  const day = new Date(`${date}T00:00:00.000Z`);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day.getUTCDay()] || date.slice(5);
}

function sparkPath(values: number[], width: number, height: number) {
  const max = Math.max(1, ...values);
  if (values.length === 0) return "";
  const step = values.length > 1 ? width / (values.length - 1) : width;
  return values
    .map((value, index) => {
      const x = index * step;
      const y = height - (value / max) * (height - 4) - 2;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export default function AdminDeskPulse({
  days,
  subscribers,
  loading,
  accessToken,
}: {
  days?: SiteDayTraffic[] | null;
  subscribers?: number | null;
  loading?: boolean;
  accessToken?: string | null;
}) {
  const points = days || [];
  const visitors = points.reduce((sum, day) => sum + day.visitors, 0);
  const applies = points.reduce((sum, day) => sum + day.applyClicks, 0);
  const views = points.reduce((sum, day) => sum + day.views, 0);
  const visitorPath = sparkPath(points.map((day) => day.visitors), 280, 64);
  const applyPath = sparkPath(points.map((day) => day.applyClicks), 280, 64);
  const [pipeBusy, setPipeBusy] = useState(false);
  const [pipeLog, setPipeLog] = useState("");

  const runPipeline = async () => {
    if (!accessToken || pipeBusy) return;
    setPipeBusy(true);
    setPipeLog("> pipeline --next\nrunning…");
    try {
      const response = await authFetch(
        "/api/admin/sourcing/pipeline/greenhouse",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ maxSources: 1 }),
        },
        accessToken,
      );
      const data = await response.json();
      const text = JSON.stringify(data.summary || data, null, 2);
      setPipeLog(`> pipeline --next\nexit ${response.status}\n${text.slice(0, 4000)}`);
    } catch (error) {
      setPipeLog(`> pipeline --next\n${error instanceof Error ? error.message : "failed"}`);
    } finally {
      setPipeBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:p-5 text-zinc-100 shadow-lg">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-400">desk://pulse</p>
          <h2 className="mt-1 text-base font-semibold text-white">Traffic · alerts · pipeline</h2>
        </div>
        <button
          type="button"
          onClick={() => void runPipeline()}
          disabled={pipeBusy || !accessToken}
          className="h-10 px-4 rounded-lg bg-emerald-500 text-zinc-950 text-xs font-mono font-semibold hover:bg-emerald-400 disabled:opacity-50"
        >
          {pipeBusy ? "pipeline…" : "$ run pipeline"}
        </button>
      </div>
      <p className="mt-1 text-[11px] font-mono text-zinc-500">
        Next stale ATS board only. Click again for another. Cron still runs in the morning.
      </p>

      <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3">
          <div className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">People / 7d</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-white">{loading ? "—" : visitors}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3">
          <div className="font-mono text-[10px] uppercase tracking-wide text-indigo-300">Apply / 7d</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-indigo-300">{loading ? "—" : applies}</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3">
          <div className="font-mono text-[10px] uppercase tracking-wide text-zinc-500">Views / 7d</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-white">{loading ? "—" : views}</div>
        </div>
        <div className="rounded-xl border border-emerald-900/60 bg-emerald-950/40 px-3 py-3">
          <div className="font-mono text-[10px] uppercase tracking-wide text-emerald-400">Alert people</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-emerald-300">
            {loading || subscribers == null ? "—" : subscribers}
          </div>
        </div>
      </div>

      {loading ? (
        <p className="mt-4 font-mono text-sm text-zinc-500">loading week…</p>
      ) : points.length === 0 ? (
        <p className="mt-4 font-mono text-sm text-zinc-500">no hits this week</p>
      ) : (
        <div className="mt-4 rounded-xl border border-zinc-800 bg-black/40 p-3">
          <svg viewBox="0 0 280 64" className="h-20 w-full" preserveAspectRatio="none" aria-hidden>
            <path d={visitorPath} fill="none" stroke="#a1a1aa" strokeWidth="2" />
            <path d={applyPath} fill="none" stroke="#6366f1" strokeWidth="2" />
          </svg>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {points.map((day) => (
              <div key={day.date} className="min-w-0 text-center">
                <p className="font-mono text-[10px] text-zinc-400">{weekday(day.date)}</p>
                <p className="font-mono text-[10px] tabular-nums text-zinc-200">{day.visitors}</p>
                <p className="font-mono text-[10px] tabular-nums text-indigo-400">{day.applyClicks}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 font-mono text-[10px] text-zinc-500">grey people · indigo apply · UTC</p>
        </div>
      )}

      {pipeLog ? (
        <pre className="mt-3 max-h-48 overflow-auto rounded-xl border border-emerald-900/50 bg-black p-3 font-mono text-[11px] leading-relaxed text-emerald-300 whitespace-pre-wrap">
          {pipeLog}
        </pre>
      ) : null}
    </section>
  );
}
