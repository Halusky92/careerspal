"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Job } from "../types";
import { createJobSlug } from "../lib/jobs";
import { formatSalaryDisplay } from "../lib/formatSalary";
import { useSupabaseAuth } from "./Providers";
import { authFetch } from "../lib/authFetch";

interface EmployerDashboardProps {
  onUpgrade: () => void;
  onPostJob: () => void;
}

type FoundingStatus = {
  enabled?: boolean;
  eligible?: boolean;
  remainingSlots?: number;
  remainingJobs?: number;
  reason?: string;
};

type ClaimHit = {
  id: string;
  name: string;
  slug?: string | null;
  claimed?: boolean;
  owned?: boolean;
};

const statusLabel = (status?: string) => {
  switch (status) {
    case "published":
      return "Active";
    case "pending_review":
      return "In review";
    case "paused":
      return "Paused";
    case "closed":
      return "Closed";
    case "archived":
      return "Archived";
    case "draft":
      return "Draft";
    default:
      return status || "Draft";
  }
};

const statusTone = (status?: string) => {
  switch (status) {
    case "published":
      return "text-emerald-700 bg-emerald-50";
    case "pending_review":
      return "text-indigo-700 bg-indigo-50";
    case "paused":
      return "text-amber-700 bg-amber-50";
    default:
      return "text-slate-600 bg-slate-100";
  }
};

const postedDate = (job: Job) => {
  if (job.timestamp) {
    const ts = job.timestamp < 1e12 ? job.timestamp * 1000 : job.timestamp;
    const d = new Date(ts);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }
  }
  return job.postedAt || "—";
};

const EmployerDashboard: React.FC<EmployerDashboardProps> = ({ onUpgrade, onPostJob }) => {
  const { accessToken } = useSupabaseAuth();
  const [myJobs, setMyJobs] = useState<Job[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [stats, setStats] = useState({ jobs: 0, views: 0, matches: 0 });
  const [founding, setFounding] = useState<FoundingStatus | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [claimQuery, setClaimQuery] = useState("");
  const [claimHits, setClaimHits] = useState<ClaimHit[]>([]);
  const [menuId, setMenuId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!accessToken) return;
    const [jobsRes, statsRes, foundingRes] = await Promise.all([
      authFetch("/api/employer/jobs", {}, accessToken),
      authFetch("/api/employer/stats", {}, accessToken),
      authFetch("/api/employer/founding", {}, accessToken),
    ]);
    if (jobsRes.ok) {
      const data = (await jobsRes.json()) as { jobs?: Job[]; summary?: Record<string, number> };
      setMyJobs(data.jobs || []);
      setSummary(data.summary || {});
    }
    if (statsRes.ok) {
      const data = (await statsRes.json()) as { jobs?: number; views?: number; matches?: number };
      setStats({ jobs: data.jobs || 0, views: data.views || 0, matches: data.matches || 0 });
    }
    if (foundingRes.ok) {
      setFounding((await foundingRes.json()) as FoundingStatus);
    }
  }, [accessToken]);

  useEffect(() => {
    reload().catch(() => undefined);
  }, [reload]);

  useEffect(() => {
    const q = claimQuery.trim();
    if (!accessToken || q.length < 2) {
      setClaimHits([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      const res = await authFetch(`/api/employer/company/search?q=${encodeURIComponent(q)}`, {}, accessToken);
      if (!res.ok) return;
      const data = (await res.json()) as { companies?: ClaimHit[] };
      setClaimHits(data.companies || []);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [accessToken, claimQuery]);

  const activeCount = useMemo(
    () => myJobs.filter((job) => job.status === "published").length,
    [myJobs],
  );

  const runAction = async (job: Job, action: "pause" | "close" | "republish" | "archive" | "delete") => {
    if (!accessToken) return;
    setBusyId(job.id);
    setMenuId(null);
    setMessage(null);
    try {
      if (action === "delete") {
        const res = await authFetch(`/api/employer/jobs/${job.id}`, { method: "DELETE" }, accessToken);
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setMessage(data.error || "Could not delete draft.");
          return;
        }
      } else {
        const res = await authFetch(
          `/api/employer/jobs/${job.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action }),
          },
          accessToken,
        );
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setMessage(data.error || "Could not update listing.");
          return;
        }
      }
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  const claimCompany = async (companyId: string) => {
    if (!accessToken) return;
    const res = await authFetch(
      "/api/employer/company/claim",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      },
      accessToken,
    );
    const data = (await res.json()) as { error?: string; note?: string };
    setMessage(data.error || data.note || "Company claimed.");
    if (res.ok) {
      setClaimQuery("");
      setClaimHits([]);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Jobs</h1>
          <p className="text-sm text-slate-500 mt-1">
            {activeCount} active · {summary.total ?? myJobs.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onUpgrade}
            className="hidden sm:inline-flex h-9 px-3 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:border-indigo-200"
          >
            Plans
          </button>
          <button
            onClick={onPostJob}
            className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
          >
            Post a job
          </button>
        </div>
      </div>

      <div className="flex gap-6 mb-6 text-sm">
        <div>
          <span className="text-slate-400">Views</span>{" "}
          <span className="font-semibold text-slate-900">{stats.views || "—"}</span>
        </div>
        <div>
          <span className="text-slate-400">Applies</span>{" "}
          <span className="font-semibold text-slate-900">{stats.matches || "—"}</span>
        </div>
      </div>

      {founding?.enabled && founding.eligible && (
        <p className="mb-4 text-sm text-slate-600">
          Start pack: {founding.remainingJobs ?? 0} free Standard listing{founding.remainingJobs === 1 ? "" : "s"} left (first 10), then $79 / $149 / $249. Reviewed before publish.
        </p>
      )}

      {message && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">{message}</div>
      )}

      <details className="mb-5 rounded-lg border border-slate-200 bg-white">
        <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-slate-700">Claim an existing company</summary>
        <div className="px-4 pb-4">
          <p className="text-sm text-slate-500">
            If a profile already exists from Greenhouse, claim it instead of creating a duplicate.
          </p>
          <input
            value={claimQuery}
            onChange={(event) => setClaimQuery(event.target.value)}
            placeholder="Search company name"
            className="cp-field mt-3 w-full rounded-lg px-3 py-2 text-sm"
          />
          {claimHits.length > 0 && (
            <div className="mt-2 space-y-1">
              {claimHits.map((hit) => (
                <div key={hit.id} className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">{hit.name}</div>
                    <div className="text-xs text-slate-400">
                      {hit.owned ? "Already yours" : hit.claimed ? "Claimed" : "Unclaimed"}
                    </div>
                  </div>
                  <button
                    disabled={Boolean(hit.claimed)}
                    onClick={() => claimCompany(hit.id)}
                    className="h-8 px-3 rounded-lg bg-slate-900 text-white text-xs font-medium disabled:opacity-40"
                  >
                    Claim
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </details>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {myJobs.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-slate-900 font-medium">No listings yet</p>
            <p className="text-sm text-slate-500 mt-1 mb-4">Post a role to track it here.</p>
            <button onClick={onPostJob} className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium">
              Add first job
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="cp-table w-full text-left text-sm">
              <thead>
                <tr className="text-xs font-medium text-slate-400 border-b border-slate-100">
                  <th className="px-4 py-2.5 font-medium">Title</th>
                  <th className="px-3 py-2.5 font-medium hidden sm:table-cell">Company</th>
                  <th className="px-3 py-2.5 font-medium">Salary</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium hidden md:table-cell">Date</th>
                  <th className="px-3 py-2.5 font-medium w-10"></th>
                </tr>
              </thead>
              <tbody>
                {myJobs.map((job) => {
                  const busy = busyId === job.id;
                  return (
                    <tr key={job.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-slate-900 line-clamp-2">{job.title}</div>
                        <div className="sm:hidden text-xs text-slate-500 mt-0.5">{job.company}</div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 hidden sm:table-cell whitespace-nowrap">{job.company}</td>
                      <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{formatSalaryDisplay(job.salary)}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded ${statusTone(job.status)}`}>
                          {statusLabel(job.status)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap hidden md:table-cell">{postedDate(job)}</td>
                      <td className="px-3 py-2.5 relative">
                        <button
                          type="button"
                          className="h-8 w-8 rounded-md text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                          aria-label="Actions"
                          onClick={() => setMenuId((prev) => (prev === job.id ? null : job.id))}
                        >
                          ⋯
                        </button>
                        {menuId === job.id && (
                          <div className="absolute right-3 top-10 z-20 w-36 rounded-lg border border-slate-200 bg-white shadow-lg py-1 text-sm">
                            <a href={`/post-a-job?jobId=${job.id}`} className="block px-3 py-1.5 hover:bg-slate-50">
                              Edit
                            </a>
                            {job.status === "published" && (
                              <a href={`/jobs/${createJobSlug(job)}`} className="block px-3 py-1.5 hover:bg-slate-50">
                                View
                              </a>
                            )}
                            {job.status === "published" && (
                              <button disabled={busy} onClick={() => runAction(job, "pause")} className="w-full text-left px-3 py-1.5 hover:bg-slate-50">
                                Pause
                              </button>
                            )}
                            {(job.status === "paused" || job.status === "closed") && (
                              <button disabled={busy} onClick={() => runAction(job, "republish")} className="w-full text-left px-3 py-1.5 hover:bg-slate-50">
                                Republish
                              </button>
                            )}
                            {(job.status === "published" || job.status === "paused") && (
                              <button disabled={busy} onClick={() => runAction(job, "close")} className="w-full text-left px-3 py-1.5 hover:bg-slate-50">
                                Close
                              </button>
                            )}
                            {job.status === "closed" && (
                              <button disabled={busy} onClick={() => runAction(job, "archive")} className="w-full text-left px-3 py-1.5 hover:bg-slate-50">
                                Archive
                              </button>
                            )}
                            {job.status === "draft" && (
                              <button disabled={busy} onClick={() => runAction(job, "delete")} className="w-full text-left px-3 py-1.5 text-rose-600 hover:bg-rose-50">
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployerDashboard;
