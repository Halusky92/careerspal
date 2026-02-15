"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Job } from "../types";
import CompanyLogo from "./CompanyLogo";
import { createCompanySlug } from "../lib/jobs";

export type JobCardVariant = "board" | "home";

type JobCardProps = {
  job: Job;
  expanded: boolean;
  onToggleExpanded: () => void;
  onOpenCompany?: (companyName: string) => void;
  onToggleBookmark?: () => void;
  isSaved?: boolean;
  showBookmark?: boolean;
  variant?: JobCardVariant;
  className?: string;
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

const isNewListing = (postedAt: string) => {
  const lower = (postedAt || "").toLowerCase();
  return lower.includes("just now") || lower.includes("hour") || lower.includes("min");
};

const getWorkMode = (job: Job) => {
  const policy = job.remotePolicy?.toLowerCase() || "";
  if (policy.includes("hybrid")) return "Hybrid";
  if (policy.includes("remote")) return "Remote";
  return "Onsite";
};

const formatPostedDate = (job: Job) => {
  if (!job.timestamp) return job.postedAt;
  const date = new Date(job.timestamp);
  return Number.isNaN(date.getTime()) ? job.postedAt : date.toLocaleDateString();
};

export default function JobCard({
  job,
  expanded,
  onToggleExpanded,
  onOpenCompany,
  onToggleBookmark,
  isSaved = false,
  showBookmark = true,
  variant = "board",
  className = "",
}: JobCardProps) {
  const router = useRouter();
  const isHome = variant === "home";

  const isElite = job.planType === "Elite Managed";
  const isPro = job.planType === "Featured Pro";
  const isStandard = !isElite && !isPro;
  const isNew = isNewListing(job.postedAt);
  const isPrivate = job.status === "private" || job.status === "invite_only";
  const workModeLabel = getWorkMode(job);
  const hasApplyUrl = Boolean(job.applyUrl && job.applyUrl.trim() && job.applyUrl !== "#");
  const tools = useMemo(() => {
    const primary = (job.tools || []).filter(Boolean);
    if (primary.length > 0) return primary;
    return (job.tags || []).filter(Boolean);
  }, [job.tags, job.tools]);

  const containerClass =
    variant === "home"
      ? "p-3.5 sm:p-4 rounded-[1.5rem] sm:rounded-[2rem]"
      : "p-3.5 sm:p-4 rounded-2xl";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggleExpanded}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onToggleExpanded();
      }}
      className={[
        containerClass,
        "transition-all cursor-pointer group flex flex-col items-stretch justify-between gap-2.5 relative active:scale-[0.99] animate-in fade-in slide-in-from-bottom-2",
        isElite
          ? "bg-amber-50 border border-amber-200 shadow-sm text-slate-900 border-l-4 border-l-amber-400"
          : isPro
            ? "bg-amber-50/60 border border-amber-200 shadow-sm hover:shadow-md border-l-4 border-l-amber-400"
            : "bg-amber-50/50 border border-amber-200 shadow-sm hover:shadow-md border-l-4 border-l-amber-300",
        isPrivate ? "opacity-70" : "",
        className,
      ].join(" ")}
    >
      {(isElite || isPro) && (
        <div
          className={`absolute -top-2 left-4 sm:left-7 px-2.5 py-1 rounded-full text-[7px] font-black uppercase tracking-widest shadow-md ${
            isElite ? "bg-yellow-200 text-yellow-900" : "bg-indigo-600 text-white"
          }`}
        >
          {isElite ? "Elite Managed" : "Featured"}
        </div>
      )}

      {isNew && (
        <div className="absolute -top-2 right-3 sm:right-8 animate-pulse z-20">
          <span className="bg-red-500 text-white text-[7px] font-black px-2 py-1 rounded-full uppercase tracking-widest shadow-red-200 shadow-lg border-2 border-white">
            New
          </span>
        </div>
      )}

      {isPrivate && (
        <div className="absolute -top-2 right-20 sm:right-28 z-20">
          <span className="bg-slate-900 text-white text-[7px] font-black px-2 py-1 rounded-full uppercase tracking-widest shadow-lg">
            Invite Only
          </span>
        </div>
      )}

      {showBookmark && onToggleBookmark && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleBookmark();
          }}
          className={`absolute top-2 right-2 sm:right-3 p-1 sm:p-1.5 rounded-full transition-all z-30 hover:scale-110 ${
            isSaved
              ? "text-pink-500 bg-pink-50"
              : isElite
                ? "text-yellow-700 hover:text-yellow-900 hover:bg-yellow-100"
                : "text-slate-300 hover:text-pink-400 hover:bg-pink-50"
          }`}
          title={isSaved ? "Saved" : "Save"}
          aria-pressed={isSaved ? "true" : "false"}
          aria-label={isSaved ? "Remove bookmark" : "Save job"}
        >
          <svg
            className="w-3.5 h-3.5"
            fill={isSaved ? "currentColor" : "none"}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
        </button>
      )}

      <div className="flex items-start gap-4 w-full">
        <div
          className={`${
            isHome
              ? "w-9 h-9 sm:w-11 sm:h-11 rounded-[0.85rem] sm:rounded-[1.05rem]"
              : "w-10 h-10 sm:w-12 sm:h-12 rounded-[0.9rem] sm:rounded-[1.1rem]"
          } flex items-center justify-center overflow-hidden p-1 flex-shrink-0 ${
            isElite ? "bg-yellow-100 border border-yellow-200" : "bg-gray-50 border border-gray-100"
          }`}
        >
          <CompanyLogo
            name={job.company}
            logoUrl={job.logo}
            website={job.companyWebsite || job.applyUrl}
            className="w-full h-full rounded-lg overflow-hidden bg-white"
            imageClassName="w-full h-full object-contain"
            fallbackClassName="text-[10px]"
          />
        </div>

        <div className="flex-1 min-w-0 pr-9">
          <h3
            className={`${isHome ? "text-sm sm:text-base" : "text-sm sm:text-base"} font-black tracking-tight leading-tight truncate ${
              isElite ? "text-slate-900 group-hover:text-yellow-700" : "text-slate-900 group-hover:text-indigo-600"
            } transition-colors`}
          >
            {job.title}
          </h3>
          <div className="flex items-center gap-2 mt-1 flex-nowrap overflow-hidden">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenCompany) {
                  onOpenCompany(job.company);
                } else {
                  router.push(`/companies/${createCompanySlug({ name: job.company })}`);
                }
              }}
              className={`font-bold uppercase text-[9px] sm:text-[10px] tracking-wider hover:underline z-10 relative truncate ${
                isElite ? "text-yellow-700" : "text-indigo-600"
              }`}
            >
              {job.company}
            </button>
            <span className={`text-[8px] flex-shrink-0 ${isElite ? "text-yellow-300" : "text-slate-300"}`}>•</span>
            <span
              className={`${isHome ? "text-[8px]" : "text-[8px] sm:text-[9px]"} font-black uppercase tracking-widest truncate ${
                isElite ? "text-yellow-700" : "text-slate-400"
              }`}
            >
              {job.location}
            </span>
            <span
              className={`text-[7px] sm:text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                isElite ? "text-yellow-700 border-yellow-200 bg-yellow-50" : "text-slate-500 border-slate-200 bg-slate-50"
              }`}
            >
              {workModeLabel}
            </span>
          </div>

          {tools.length > 0 && (
            <div className="flex gap-2 mt-2.5 flex-wrap">
              {tools.slice(0, isHome ? 2 : 2).map((tool) => (
                <span
                  key={tool}
                  className={`text-[6px] font-black px-2 py-1 rounded-lg border uppercase tracking-widest ${
                    isElite ? "bg-yellow-100 text-yellow-800 border-yellow-200" : "bg-slate-50 text-slate-400 border-slate-100"
                  }`}
                >
                  {tool}
                </span>
              ))}
              {tools.length > 2 && (
                <span
                  className={`text-[6px] font-black px-2 py-1 rounded-lg border uppercase tracking-widest ${
                    isElite ? "bg-yellow-100 text-yellow-800 border-yellow-200" : "bg-slate-50 text-slate-400 border-slate-100"
                  }`}
                >
                  +{tools.length - 2}
                </span>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-[7px] font-black uppercase tracking-widest px-2 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
              Verified Employer
            </span>
            {!isStandard && (
              <span className="text-[7px] font-black uppercase tracking-widest px-2 py-1 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-600">
                Response SLA 2d
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="w-full border-t border-slate-100 pt-2 flex items-center justify-between gap-3">
        <div
          className={`${isHome ? "text-sm sm:text-base" : "text-sm sm:text-base"} font-black tracking-tight whitespace-nowrap ${
            isElite ? "text-yellow-900" : "text-slate-900"
          }`}
        >
          {job.salary}
        </div>

        <button
          onClick={async (event) => {
            event.stopPropagation();
            if (isPrivate) {
              router.push("/auth");
              return;
            }
            if (!hasApplyUrl) return;
            try {
              await fetch(`/api/jobs/${job.id}/match`, { method: "POST" });
            } catch {
              // no-op
            }
            window.open(job.applyUrl, "_blank", "noopener,noreferrer");
          }}
          disabled={!isPrivate && !hasApplyUrl}
          className={`inline-flex items-center justify-center rounded-full ${
            isHome ? "px-4 py-2 text-[10px]" : "px-5 py-2.5 text-[10px]"
          } font-black uppercase tracking-widest transition-all w-auto ${
            isElite
              ? "bg-yellow-200 text-yellow-900 hover:bg-yellow-300"
              : hasApplyUrl
                ? "bg-indigo-600 text-white hover:bg-indigo-700"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
          }`}
        >
          {isPrivate ? "Request access" : hasApplyUrl ? "Quick apply" : "Apply soon"}
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 mt-1">
        <span className={`text-[7px] sm:text-[8px] font-black uppercase tracking-widest ${isElite ? "text-yellow-700" : "text-slate-300"}`}>
          {formatPostedDate(job)}
        </span>
        {job.matchScore && (
          <span
            className={`text-[7px] sm:text-[8px] font-black px-2 py-1 rounded-lg border ${
              isElite ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-indigo-50 text-indigo-600 border border-indigo-100"
            }`}
          >
            Match {job.matchScore}%
          </span>
        )}
      </div>

      {expanded && (
        <div className="w-full bg-slate-50 border border-slate-100 rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 text-left">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Role overview</p>
            <p className="text-sm sm:text-base text-slate-700 mt-2 whitespace-pre-wrap">
              {sanitizeDescription(job.description) || "Description coming soon."}
            </p>
          </div>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] font-bold text-slate-600">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <span className="text-[9px] uppercase tracking-widest text-slate-400">Company</span>
              <div className="mt-1">{job.company || "N/A"}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <span className="text-[9px] uppercase tracking-widest text-slate-400">Location</span>
              <div className="mt-1">{job.location || "N/A"}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <span className="text-[9px] uppercase tracking-widest text-slate-400">Work mode</span>
              <div className="mt-1">{workModeLabel}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <span className="text-[9px] uppercase tracking-widest text-slate-400">Employment type</span>
              <div className="mt-1">{job.type || "N/A"}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <span className="text-[9px] uppercase tracking-widest text-slate-400">Salary</span>
              <div className="mt-1">{job.salary || "N/A"}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <span className="text-[9px] uppercase tracking-widest text-slate-400">Posted</span>
              <div className="mt-1">{formatPostedDate(job)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

