"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Job } from "../types";
import { createJobSlug } from "../lib/jobs";
import { formatSalaryDisplay } from "../lib/formatSalary";
import { formatShortPostedDate } from "../lib/formatPosted";
import { useSupabaseAuth } from "./Providers";
import { authFetch } from "../lib/authFetch";
import StartPackMeter from "./StartPackMeter";
import type { StartPackStatus } from "../lib/founding";
import type { PublicPerson } from "../lib/publicPerson";
import Link from "next/link";
import { PLAN_PRICES } from "../lib/plans";
import JobViewCount from "./JobViewCount";
import ListingPlanBadge from "./ListingPlanBadge";
import { companyPackKey, countCompanyPackUsage } from "../lib/listingPlan";

type TrafficSource = { source: string; label?: string; views: number; applyClicks: number };

interface EmployerDashboardProps {
  onUpgrade: () => void;
  onPostJob: () => void;
}

type FoundingStatus = StartPackStatus;

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
    const label = formatShortPostedDate(job.timestamp);
    if (label) return label;
  }
  return job.postedAt || "—";
};

const EmployerDashboard: React.FC<EmployerDashboardProps> = ({ onUpgrade, onPostJob }) => {
  const { accessToken } = useSupabaseAuth();
  const [myJobs, setMyJobs] = useState<Job[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [stats, setStats] = useState({ jobs: 0, views: 0, matches: 0, applyClicks: 0, sources: [] as TrafficSource[] });
  const [founding, setFounding] = useState<FoundingStatus | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"ok" | "error">("ok");
  const [showOlderJobs, setShowOlderJobs] = useState(false);
  const [claimQuery, setClaimQuery] = useState("");
  const [claimHits, setClaimHits] = useState<ClaimHit[]>([]);
  const [shortlist, setShortlist] = useState<{ id: string; jobId: string; jobTitle: string; person: PublicPerson | null }[]>([]);

  const reload = useCallback(async () => {
    if (!accessToken) return;
    const [jobsRes, statsRes, foundingRes, shortRes] = await Promise.all([
      authFetch("/api/employer/jobs", {}, accessToken),
      authFetch("/api/employer/stats", {}, accessToken),
      authFetch("/api/employer/founding", {}, accessToken),
      authFetch("/api/people/shortlist", {}, accessToken),
    ]);
    if (jobsRes.ok) {
      const data = (await jobsRes.json()) as { jobs?: Job[]; summary?: Record<string, number> };
      setMyJobs(data.jobs || []);
      setSummary(data.summary || {});
    }
    if (statsRes.ok) {
      const data = (await statsRes.json()) as {
        jobs?: number;
        views?: number;
        matches?: number;
        applyClicks?: number;
        sources?: TrafficSource[];
      };
      setStats({
        jobs: data.jobs || 0,
        views: data.views || 0,
        matches: data.matches || 0,
        applyClicks: data.applyClicks ?? data.matches ?? 0,
        sources: data.sources || [],
      });
    }
    if (foundingRes.ok) {
      setFounding((await foundingRes.json()) as FoundingStatus);
    }
    if (shortRes.ok) {
      const data = (await shortRes.json()) as {
        items?: { id: string; jobId: string; jobTitle: string; person: PublicPerson | null }[];
      };
      setShortlist(data.items || []);
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
  const newestJobs = myJobs.slice(0, 5);
  const olderJobs = myJobs.slice(5);
  const packUsedByCompany = useMemo(() => {
    const used = countCompanyPackUsage(myJobs);
    const fromApi = founding?.usedJobs || 0;
    if (!fromApi) return used;
    const keys = new Set([...used.keys(), ...myJobs.map((job) => companyPackKey(job))]);
    for (const key of keys) used.set(key, Math.max(used.get(key) || 0, fromApi));
    return used;
  }, [myJobs, founding]);

  const runAction = async (job: Job, action: "pause" | "close" | "republish" | "archive" | "delete" | "publish") => {
    if (!accessToken) return;
    setBusyId(job.id);
    setMessage(null);
    try {
      if (action === "delete") {
        const res = await authFetch(`/api/employer/jobs/${job.id}`, { method: "DELETE" }, accessToken);
        const data = (await res.json()) as { error?: string };
        if (!res.ok) {
          setMessageTone("error");
          setMessage(data.error || "Could not remove listing.");
          return;
        }
        setMessageTone("ok");
        setMessage("Listing removed.");
        setMyJobs((prev) => prev.filter((item) => item.id !== job.id));
      } else if (action === "publish" && job.status === "draft") {
        const submit = await authFetch(
          `/api/employer/jobs/${job.id}/submit`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) },
          accessToken,
        );
        const submitData = (await submit.json()) as { error?: string; checkoutRequired?: boolean };
        if (submit.status === 402 || submitData.checkoutRequired) {
          onUpgrade();
          return;
        }
        if (!submit.ok) {
          setMessageTone("error");
          setMessage(submitData.error || "Could not publish listing.");
          return;
        }
        setMessageTone("ok");
        setMessage("Sent for review.");
        setMyJobs((prev) => prev.map((item) => (item.id === job.id ? { ...item, status: "pending_review" } : item)));
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
        const data = (await res.json()) as {
          error?: string;
          checkoutRequired?: boolean;
          submitRequired?: boolean;
          price?: number;
          planName?: string;
          purpose?: string;
        };
        if (res.status === 409 && data.submitRequired) {
          const submit = await authFetch(
            `/api/employer/jobs/${job.id}/submit`,
            { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) },
            accessToken,
          );
          const submitData = (await submit.json()) as { error?: string; checkoutRequired?: boolean };
          if (submit.status === 402 || submitData.checkoutRequired) {
            onUpgrade();
            return;
          }
          if (!submit.ok) {
            setMessageTone("error");
            setMessage(submitData.error || "Could not publish listing.");
            return;
          }
          setMessageTone("ok");
          setMessage("Sent for review.");
          await reload();
          return;
        }
        if (res.status === 402 && data.checkoutRequired) {
          const pay = await authFetch(
            "/api/stripe/checkout",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                jobId: job.id,
                price: data.price ?? PLAN_PRICES.standard,
                planName: data.planName || "Standard",
                purpose: data.purpose || "republish",
              }),
            },
            accessToken,
          );
          const payJson = (await pay.json()) as { url?: string; error?: string };
          if (!pay.ok || !payJson.url) {
            setMessageTone("error");
            setMessage(payJson.error || data.error || "Could not start renewal checkout.");
            return;
          }
          window.location.href = payJson.url;
          return;
        }
        if (!res.ok) {
          setMessageTone("error");
          setMessage(data.error || "Could not update listing.");
          return;
        }
        setMessageTone("ok");
        const nextStatus =
          action === "publish"
            ? "published"
            : action === "close"
              ? "closed"
              : action === "pause"
                ? "paused"
                : action === "archive"
                  ? "archived"
                  : job.status;
        setMyJobs((prev) => prev.map((item) => (item.id === job.id ? { ...item, status: nextStatus } : item)));
        setMessage(
          action === "publish"
            ? "Listing is live."
            : action === "close"
              ? "Listing closed."
              : action === "pause"
                ? "Listing paused."
                : "Listing updated.",
        );
      }
      await reload();
    } finally {
      setBusyId(null);
    }
  };

  const renderJobCard = (job: Job) => {
    const busy = busyId === job.id;
    const canPublish = job.status === "pending_review" || job.status === "draft";
    const canClose = job.status === "published" || job.status === "paused" || job.status === "pending_review";
    const btn = "h-9 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 disabled:opacity-50";
    return (
      <article key={job.id} className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-slate-900 leading-snug">{job.title}</p>
              <ListingPlanBadge job={job} packUsedByCompany={packUsedByCompany} />
            </div>
            <p className="mt-1 text-sm text-slate-500 truncate">
              {[job.company, formatSalaryDisplay(job.salary), postedDate(job)].filter(Boolean).join(" · ")} ·{" "}
              <JobViewCount views={job.views} />
            </p>
          </div>
          <span className={`shrink-0 inline-flex text-xs font-medium px-2 py-0.5 rounded ${statusTone(job.status)}`}>
            {statusLabel(job.status)}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {canPublish ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => runAction(job, "publish")}
              className="h-9 px-3 rounded-lg bg-emerald-600 text-white text-xs font-medium disabled:opacity-50"
            >
              Publish
            </button>
          ) : null}
          <a
            href={`/post-a-job?jobId=${job.id}`}
            className="h-9 px-3 inline-flex items-center rounded-lg border border-slate-200 text-xs font-medium text-slate-700"
          >
            Edit
          </a>
          {job.status === "published" ? (
            <a
              href={`/jobs/${createJobSlug(job)}`}
              className="h-9 px-3 inline-flex items-center rounded-lg border border-slate-200 text-xs font-medium text-slate-700"
            >
              View
            </a>
          ) : null}
          {job.status === "published" ? (
            <button type="button" disabled={busy} onClick={() => runAction(job, "pause")} className={btn}>
              Pause
            </button>
          ) : null}
          {(job.status === "paused" || job.status === "closed" || job.status === "archived") ? (
            <button type="button" disabled={busy} onClick={() => runAction(job, "republish")} className="h-9 px-3 rounded-lg bg-emerald-600 text-white text-xs font-medium disabled:opacity-50">
              Renew
            </button>
          ) : null}
          {canClose ? (
            <button type="button" disabled={busy} onClick={() => runAction(job, "close")} className={btn}>
              Close
            </button>
          ) : null}
          <button type="button" disabled={busy} onClick={() => runAction(job, "delete")} className="h-9 px-3 rounded-lg text-xs font-medium text-rose-600 disabled:opacity-50">
            Remove
          </button>
        </div>
      </article>
    );
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
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Your jobs</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {activeCount} live · {summary.total ?? myJobs.length} total
          </p>
        </div>
        <button
          onClick={onPostJob}
          className="h-10 px-4 rounded-xl bg-indigo-600 text-white text-sm font-medium"
        >
          Post a job
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-5">
        {[
          { label: "Live", value: activeCount },
          { label: "Views", value: stats.views || 0 },
          { label: "Applies", value: stats.applyClicks || stats.matches || 0 },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
            <div className="text-[11px] uppercase tracking-wide text-slate-400">{item.label}</div>
            <div className="text-lg font-semibold text-slate-900 mt-0.5">{item.value}</div>
          </div>
        ))}
      </div>

      {founding?.enabled && (
        <div className="mb-4">
          <StartPackMeter status={founding} />
        </div>
      )}

      {shortlist.length > 0 ? (
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-900">Suggested seekers</p>
            <Link href="/people" className="text-sm font-medium text-indigo-600">
              People
            </Link>
          </div>
          <ul className="mt-3 space-y-2">
            {shortlist.slice(0, 3).map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">{item.person?.name || "Seeker"}</div>
                  <div className="text-xs text-slate-500 truncate">{item.jobTitle}</div>
                </div>
                {item.person?.token ? (
                  <Link href={`/p/${item.person.token}`} className="text-xs font-medium text-indigo-600">
                    Open
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {message && (
        <div
          className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
            messageTone === "error" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {message}
        </div>
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

      <div className="space-y-3">
        {myJobs.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center">
            <p className="text-slate-900 font-medium">No listings yet</p>
            <button onClick={onPostJob} className="mt-4 h-10 px-4 rounded-xl bg-indigo-600 text-white text-sm font-medium">
              Post a job
            </button>
          </div>
        ) : (
          newestJobs.map((job) => renderJobCard(job))
        )}
        {olderJobs.length > 0 ? (
          <div>
            <button
              type="button"
              onClick={() => setShowOlderJobs((prev) => !prev)}
              className="w-full h-11 rounded-2xl border border-slate-200 bg-white text-sm font-medium text-slate-700"
            >
              {showOlderJobs ? "Hide older listings" : `Older listings (${olderJobs.length})`}
            </button>
            {showOlderJobs ? <div className="mt-3 space-y-3">{olderJobs.map((job) => renderJobCard(job))}</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default EmployerDashboard;
