"use client";

import { useEffect, useState } from "react";
import { useSupabaseAuth } from "../Providers";
import { authFetch } from "../../lib/authFetch";

type WindowCounts = { sources: number; companies: number; published: number | null; closed: number | null };
type Overview = {
  windows: { today: WindowCounts; days7: WindowCounts; days30: WindowCounts } | null;
  discoveredBoards: number | null;
  pendingReview: number | null;
  autoApproved: number | null;
  publishedJobs: number | null;
  tavily: { used: number | null; cap: number };
  runs: Array<{ createdAt: string; trigger: string | null; error: string | null }>;
};

function cell(value: number | null | undefined) {
  return value == null ? "—" : String(value);
}

export default function SourcingOverviewSection() {
  const { accessToken } = useSupabaseAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accessToken) return;
    let cancel = false;
    authFetch("/api/admin/sourcing/overview", {}, accessToken)
      .then(async (response) => {
        if (!response.ok) throw new Error("unavailable");
        return response.json() as Promise<Overview>;
      })
      .then((data) => {
        if (!cancel) setOverview(data);
      })
      .catch(() => {
        if (!cancel) setError("Sourcing overview is unavailable.");
      });
    return () => {
      cancel = true;
    };
  }, [accessToken]);

  const windows = overview?.windows;
  const rows = windows
    ? [
        ["Today", windows.today],
        ["7 days", windows.days7],
        ["30 days", windows.days30],
      ]
    : [];

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-900">Sourcing overview</p>
      <p className="mt-0.5 text-xs text-slate-500">UTC. A dash means the history was not recorded.</p>
      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
      {!overview && !error ? <p className="mt-3 text-sm text-slate-500">Loading…</p> : null}
      {overview ? (
        <div className="mt-3 space-y-3 text-sm">
          <div className="grid grid-cols-3 gap-2">
            {rows.map(([label, counts]) => {
              const item = counts as WindowCounts;
              return (
                <div key={String(label)} className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="text-xs text-slate-400">{label}</div>
                  <div className="mt-1 text-slate-700">{cell(item.companies)} companies</div>
                  <div className="text-slate-700">{cell(item.sources)} ATS sources</div>
                  <div className="text-slate-700">{cell(item.published)} published</div>
                  <div className="text-slate-700">{cell(item.closed)} closed</div>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div><div className="text-xs text-slate-400">Boards seen</div><div className="font-medium">{cell(overview.discoveredBoards)}</div></div>
            <div><div className="text-xs text-slate-400">Waiting review</div><div className="font-medium">{cell(overview.pendingReview)}</div></div>
            <div><div className="text-xs text-slate-400">Auto-approved</div><div className="font-medium">{cell(overview.autoApproved)}</div></div>
            <div><div className="text-xs text-slate-400">Live jobs</div><div className="font-medium">{cell(overview.publishedJobs)}</div></div>
          </div>
          <p className="text-slate-700">Tavily {cell(overview.tavily.used)} / {overview.tavily.cap} this month</p>
          <div>
            <div className="text-xs text-slate-400">Recent runs</div>
            {overview.runs.length === 0 ? <p className="text-slate-500">No pipeline runs recorded.</p> : null}
            {overview.runs.map((run) => (
              <p key={run.createdAt} className="text-slate-700">
                {new Date(run.createdAt).toISOString().slice(0, 16).replace("T", " ")} UTC · {run.trigger || "run"}
                {run.error ? ` · ${run.error}` : ""}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
