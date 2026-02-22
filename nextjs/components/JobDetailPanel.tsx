"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Job } from "../types";
import CompanyLogo from "./CompanyLogo";
import { createCompanySlug } from "../lib/jobs";

type JobDetailPanelProps = {
  job: Job | null;
  allJobs: Job[];
  onClose: () => void;
  onApply: (job: Job) => void;
  onSelectJobId?: (jobId: string) => void;
  onToggleSave?: (jobId: string) => void;
  isSaved?: (jobId: string) => boolean;
};

const sanitizeDescription = (value?: string | null) => {
  if (!value) return "";
  const lines = value.split("\n");
  const cleaned = lines.filter((line) => {
    const trimmed = line.trim().toLowerCase();
    if (!trimmed) return true;
    if (trimmed.startsWith("import-") || trimmed.startsWith("import/")) return false;
    if (trimmed.includes("import-") && !trimmed.includes(" ")) return false;
    return true;
  });
  return cleaned.join("\n").trim();
};

const formatPosted = (job: Job) => {
  if (!job.timestamp) return job.postedAt;
  const date = new Date(job.timestamp);
  return Number.isNaN(date.getTime()) ? job.postedAt : date.toLocaleDateString();
};

export default function JobDetailPanel({
  job,
  allJobs,
  onClose,
  onApply,
  onSelectJobId,
  onToggleSave,
  isSaved,
}: JobDetailPanelProps) {
  const router = useRouter();

  const stack = useMemo(() => {
    if (!job) return [];
    const tools = (job.tools || []).filter(Boolean);
    if (tools.length > 0) return tools;
    return (job.tags || []).filter(Boolean);
  }, [job]);

  const similarJobs = useMemo(() => {
    if (!job) return [];
    return allJobs
      .filter((j) => {
        const isPublic = !j.status || j.status === "published";
        const sharesSignals = j.category === job.category || j.tags.some((t) => job.tags.includes(t));
        return j.id !== job.id && isPublic && sharesSignals;
      })
      .slice(0, 3);
  }, [allJobs, job]);

  if (!job) {
    return (
      <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-hidden rounded-[2.5rem] border border-slate-200/60 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
        <div className="p-6">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            Role details
          </div>
          <div className="mt-3 text-sm font-bold text-slate-600">
            Select a role to preview details.
          </div>
        </div>
      </div>
    );
  }

  const saved = isSaved ? isSaved(job.id) : false;

  return (
    <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-hidden rounded-[2.5rem] border border-slate-200/60 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl overflow-hidden bg-white border border-slate-200/70 p-1 flex-shrink-0">
            <CompanyLogo
              name={job.company}
              logoUrl={job.logo}
              website={job.companyWebsite || job.applyUrl}
              className="w-full h-full rounded-xl overflow-hidden bg-white"
              imageClassName="w-full h-full object-contain"
              fallbackClassName="text-[10px]"
            />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Role details
            </div>
            <div className="text-sm font-black text-slate-900 truncate">{job.title}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {onToggleSave && isSaved && (
            <button
              onClick={() => onToggleSave(job.id)}
              className={[
                "h-10 w-10 rounded-2xl border flex items-center justify-center transition-colors",
                saved
                  ? "bg-pink-50 border-pink-200 text-pink-600"
                  : "bg-white border-slate-200/70 text-slate-400 hover:text-pink-500 hover:border-pink-200",
              ].join(" ")}
              aria-pressed={saved ? "true" : "false"}
              aria-label={saved ? "Unsave role" : "Save role"}
              title={saved ? "Saved" : "Save"}
            >
              <svg className="w-5 h-5" fill={saved ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
            </button>
          )}
          <button
            onClick={onClose}
            className="h-10 w-10 rounded-2xl border border-slate-200/70 bg-white text-slate-500 hover:border-indigo-200 hover:text-indigo-700 flex items-center justify-center"
            aria-label="Close details"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="overflow-y-auto max-h-[calc(100vh-7rem)] pb-28">
        <div className="px-6 pt-5">
          <div className="flex flex-wrap items-center gap-2">
            {job.planType && job.planType !== "Standard" && (
              <span className="inline-flex items-center rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-indigo-700">
                Response SLA 2d
              </span>
            )}
            <span className="inline-flex items-center rounded-full bg-slate-50 border border-slate-200/70 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-slate-600">
              {job.type}
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-50 border border-slate-200/70 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-slate-600">
              {job.location}
            </span>
            {job.remotePolicy && (
              <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-700">
                {job.remotePolicy}
              </span>
            )}
            <span className="inline-flex items-center rounded-full bg-white border border-slate-200/70 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
              Posted {formatPosted(job)}
            </span>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <button
                onClick={() => router.push(`/companies/${createCompanySlug({ name: job.company })}`)}
                className="text-sm font-black text-indigo-700 hover:text-indigo-800 hover:underline decoration-indigo-300 underline-offset-2 truncate"
              >
                {job.company}
              </button>
              <div className="text-sm font-black text-slate-900 mt-1">{job.salary}</div>
            </div>
            <button
              onClick={() => onApply(job)}
              className="h-11 px-6 rounded-2xl bg-indigo-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-100"
            >
              Quick apply
            </button>
          </div>

          {stack.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {stack.slice(0, 10).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full bg-white border border-slate-200/70 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-slate-500"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="mt-6 rounded-[2rem] border border-slate-200/60 bg-slate-50/60 p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              About the role
            </div>
            <div className="mt-3 text-sm font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">
              {sanitizeDescription(job.description) || "Description is being updated."}
            </div>
          </div>

          {similarJobs.length > 0 && (
            <div className="mt-7">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Similar roles
              </div>
              <div className="mt-3 space-y-2">
                {similarJobs.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      if (onSelectJobId) {
                        onSelectJobId(s.id);
                        return;
                      }
                      router.push(`/jobs?jobId=${encodeURIComponent(s.id)}`);
                    }}
                    className="w-full text-left rounded-2xl border border-slate-200/60 bg-white px-4 py-3 hover:border-indigo-200 hover:bg-indigo-50/40 transition-colors"
                  >
                    <div className="text-xs font-black text-slate-900 truncate">{s.title}</div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1 truncate">
                      {s.company} • {s.salary}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

