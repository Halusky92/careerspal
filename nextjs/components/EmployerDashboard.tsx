"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Job } from "../types";
import { createJobSlug } from "../lib/jobs";
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

const formatCount = (value?: number | null) => {
  if (!value) return "—";
  return String(value);
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
      return "text-emerald-700 bg-emerald-50 border-emerald-200";
    case "pending_review":
      return "text-indigo-700 bg-indigo-50 border-indigo-200";
    case "paused":
      return "text-amber-700 bg-amber-50 border-amber-200";
    case "closed":
    case "archived":
      return "text-slate-600 bg-slate-50 border-slate-200";
    default:
      return "text-slate-500 bg-slate-50 border-slate-200";
  }
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
    <div className="relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-15%] w-[70%] h-[70%] bg-indigo-300/20 rounded-full blur-[140px]"></div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative z-10">
        <div className="mb-10 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8">
          <div>
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-2">My company</p>
            <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tighter mb-3">Dashboard</h1>
            <p className="text-lg text-slate-500 font-medium">Your listings, status, and apply clicks in one place.</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={onPostJob}
              className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700"
            >
              Post a job
            </button>
            <button
              onClick={onUpgrade}
              className="bg-white text-slate-900 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest border border-slate-200 hover:border-indigo-200"
            >
              Plans
            </button>
          </div>
        </div>

        {founding?.enabled && (
          <div className="mb-8 rounded-3xl border border-indigo-100 bg-white/90 px-6 py-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Founding launch</p>
            <p className="mt-2 text-slate-700 font-medium">
              {founding.eligible
                ? `Eligible companies can submit for review without checkout. ${founding.remainingSlots ?? 0} company slots and ${founding.remainingJobs ?? 0} listing slots remain.`
                : "Checkout is required for additional listings. Stripe stays available when founding slots are used."}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {[
            { label: "Active roles", value: activeCount },
            { label: "Views", value: stats.views || "—" },
            { label: "Apply clicks", value: stats.matches || "—" },
          ].map((item) => (
            <div key={item.label} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
              <div className="text-3xl font-black text-slate-900">{item.value}</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{item.label}</div>
            </div>
          ))}
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600">
            {message}
          </div>
        )}

        <div className="mb-10 rounded-[2rem] border border-slate-100 bg-white p-6">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Claim this company</h2>
          <p className="mt-2 text-sm text-slate-500 font-medium">
            If a profile was created from Greenhouse, claim it instead of making a duplicate. Sourced jobs stay separate.
          </p>
          <input
            value={claimQuery}
            onChange={(event) => setClaimQuery(event.target.value)}
            placeholder="Search company name"
            className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium"
          />
          {claimHits.length > 0 && (
            <div className="mt-3 space-y-2">
              {claimHits.map((hit) => (
                <div key={hit.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 px-4 py-3">
                  <div>
                    <div className="font-black text-slate-900">{hit.name}</div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {hit.owned ? "Already yours" : hit.claimed ? "Claimed" : "Unclaimed"}
                    </div>
                  </div>
                  <button
                    disabled={Boolean(hit.claimed)}
                    onClick={() => claimCompany(hit.id)}
                    className="px-4 py-2 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-40"
                  >
                    Claim
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">My job postings</h3>
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
              {summary.total ?? myJobs.length} listings
            </span>
          </div>
          {myJobs.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <h3 className="text-2xl font-black text-slate-900 mb-3">No listings yet</h3>
              <p className="text-slate-500 font-medium mb-8">Post a role to see status, views, and apply clicks here.</p>
              <button onClick={onPostJob} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black">
                Add first job
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-t border-slate-100">
                    <th className="px-6 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Views</th>
                    <th className="px-4 py-3">Apply clicks</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {myJobs.map((job) => {
                    const busy = busyId === job.id;
                    return (
                      <tr key={job.id} className="border-t border-slate-100">
                        <td className="px-6 py-4">
                          <div className="font-black text-slate-900">{job.title}</div>
                          <div className="text-xs text-slate-400 font-medium">
                            {job.company}
                            {job.status === "published" && (
                              <>
                                {" · "}
                                <a href={`/jobs/${createJobSlug(job)}`} className="text-indigo-600 hover:underline">
                                  View
                                </a>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-lg border ${statusTone(job.status)}`}>
                            {statusLabel(job.status)}
                          </span>
                        </td>
                        <td className="px-4 py-4 font-black text-slate-700">{formatCount(job.views)}</td>
                        <td className="px-4 py-4 font-black text-slate-700">{formatCount(job.matches)}</td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2 flex-wrap">
                            <a
                              href={`/post-a-job?jobId=${job.id}`}
                              className="h-9 w-9 inline-flex items-center justify-center rounded-xl bg-slate-50 text-slate-600 hover:text-indigo-600"
                              title="Edit"
                            >
                              ✎
                            </a>
                            {job.status === "published" && (
                              <button disabled={busy} onClick={() => runAction(job, "pause")} className="h-9 w-9 rounded-xl bg-amber-50" title="Pause">
                                ⏸
                              </button>
                            )}
                            {(job.status === "paused" || job.status === "closed") && (
                              <button disabled={busy} onClick={() => runAction(job, "republish")} className="h-9 w-9 rounded-xl bg-indigo-50" title="Republish">
                                ↻
                              </button>
                            )}
                            {(job.status === "published" || job.status === "paused") && (
                              <button disabled={busy} onClick={() => runAction(job, "close")} className="h-9 w-9 rounded-xl bg-slate-100" title="Close">
                                ✕
                              </button>
                            )}
                            {job.status === "closed" && (
                              <button disabled={busy} onClick={() => runAction(job, "archive")} className="h-9 w-9 rounded-xl bg-slate-100" title="Archive">
                                📦
                              </button>
                            )}
                            {job.status === "draft" && (
                              <button disabled={busy} onClick={() => runAction(job, "delete")} className="h-9 w-9 rounded-xl bg-rose-50" title="Delete draft">
                                🗑
                              </button>
                            )}
                          </div>
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
    </div>
  );
};

export default EmployerDashboard;
