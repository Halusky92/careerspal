"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Job } from "../types";
import CompanyLogo from "./CompanyLogo";
import { createCompanySlug, createJobSlug } from "../lib/jobs";

export type JobRowAction = "copy_link" | "open_new_tab";

export type JobRowVariant = "board" | "home";

type JobRowProps = {
  job: Job;
  variant?: JobRowVariant;
  selected?: boolean;
  expanded?: boolean;
  isSaved?: boolean;
  showSave?: boolean;
  showMenu?: boolean;
  onSelect: () => void;
  onToggleSave?: () => void;
  onApply: () => void;
  onAction?: (action: JobRowAction) => void;
  onOpenCompany?: (companyName: string) => void;
};

const getWorkMode = (job: Job) => {
  const policy = (job.remotePolicy || "").toLowerCase();
  if (policy.includes("hybrid")) return "Hybrid";
  if (policy.includes("remote")) return "Remote";
  return "Onsite";
};

const formatTimeAgo = (job: Job) => {
  if (!job.timestamp) return job.postedAt || "";
  const diffMs = Date.now() - job.timestamp;
  if (!Number.isFinite(diffMs) || diffMs < 0) return job.postedAt || "";
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  try {
    return new Date(job.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return job.postedAt || "";
  }
};

const getRemoteMeta = (job: Job, workMode: string) => {
  const loc = (job.location || "").trim();
  const lower = loc.toLowerCase();
  const looksRemote = lower.includes("remote");
  const clean = loc
    .replace(/remote/gi, "")
    .replace(/[()]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const region =
    lower.includes("world") || lower.includes("global")
      ? "Worldwide"
      : lower.includes("europe") || lower.includes("emea") || lower.includes("eu")
        ? "Europe"
        : lower.includes("us") || lower.includes("usa") || lower.includes("united states")
          ? "US"
          : clean && clean.toLowerCase() !== "remote" && !looksRemote
            ? clean
            : "";

  if (workMode === "Remote") return region ? `Remote • ${region}` : "Remote";
  if (workMode === "Hybrid") return region ? `Hybrid • ${region}` : "Hybrid";
  return region ? `Onsite • ${region}` : "Onsite";
};

export default function JobRow({
  job,
  variant = "board",
  selected = false,
  expanded = false,
  isSaved = false,
  showSave = true,
  showMenu = true,
  onSelect,
  onToggleSave,
  onApply,
  onAction,
  onOpenCompany,
}: JobRowProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const isElite = job.planType === "Elite Managed";
  const isPro = job.planType === "Featured Pro";
  const isPrivate = job.status === "private" || job.status === "invite_only";
  const workMode = useMemo(() => getWorkMode(job), [job.remotePolicy]);
  const timeAgo = useMemo(() => formatTimeAgo(job), [job.timestamp, job.postedAt]);
  const stack = useMemo(() => {
    const tools = (job.tools || []).filter(Boolean);
    if (tools.length > 0) return tools;
    return (job.tags || []).filter(Boolean);
  }, [job.tags, job.tools]);

  const href = `/jobs/${createJobSlug(job)}`;

  const isHome = variant === "home";
  const maxTags = 2;
  const descriptionText = (job.description || "").replace(/\s+/g, " ").trim();
  const descriptionPreview =
    descriptionText.length > 520 ? `${descriptionText.slice(0, 520).trim()}…` : descriptionText;
  const remoteMeta = useMemo(() => getRemoteMeta(job, workMode), [job.location, workMode]);

  const chips = useMemo(() => {
    const out: string[] = [];
    if (job.type) out.push(job.type);
    const toolList = (stack || []).filter(Boolean);
    out.push(...toolList.slice(0, 2));
    if (out.length < 3 && job.category) out.push(job.category);
    return out.slice(0, 3);
  }, [job.type, job.category, stack]);

  return (
    <div
      className={[
        "group relative rounded-2xl border transition-all",
        isElite
          ? "bg-amber-50 border-amber-200"
          : isPro
            ? "bg-amber-50/70 border-amber-200"
            : "bg-amber-50/50 border-amber-200/80",
        selected ? "ring-2 ring-indigo-600 ring-offset-2 ring-offset-[#F8F9FD]" : "hover:shadow-sm",
        isPrivate ? "opacity-80" : "",
      ].join(" ")}
      role="button"
      tabIndex={0}
      onClick={() => {
        setMenuOpen(false);
        onSelect();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        setMenuOpen(false);
        onSelect();
      }}
      aria-current={selected ? "true" : undefined}
      aria-expanded={expanded ? "true" : "false"}
    >
      <div className={["flex items-start gap-3", isHome ? "px-3.5 py-3" : "px-4 py-3.5"].join(" ")}>
        <div
          className={[
            "mt-0.5 rounded-2xl overflow-hidden bg-white border border-slate-200/70 p-1 flex-shrink-0",
            isHome ? "w-10 h-10" : "w-11 h-11",
          ].join(" ")}
        >
          <CompanyLogo
            name={job.company}
            logoUrl={job.logo}
            website={job.companyWebsite || job.applyUrl}
            className="w-full h-full rounded-xl overflow-hidden bg-white"
            imageClassName="w-full h-full object-contain"
            fallbackClassName="text-[10px]"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className={[isHome ? "text-[15px]" : "text-[15px] sm:text-base", "font-black text-slate-900 leading-snug truncate"].join(" ")}>
                {job.title}
              </h3>

              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-bold text-slate-700">
                <button
                  className="hover:text-indigo-600 hover:underline decoration-indigo-300 underline-offset-2 truncate"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onOpenCompany) {
                      onOpenCompany(job.company);
                      return;
                    }
                    router.push(`/companies/${createCompanySlug({ name: job.company })}`);
                  }}
                  title={job.company}
                >
                  {job.company}
                </button>

                {(isElite || isPro) && (
                  <span
                    className={[
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest",
                      isElite
                        ? "bg-amber-200/70 text-amber-950 border border-amber-300"
                        : "bg-amber-100 text-amber-900 border border-amber-200",
                    ].join(" ")}
                  >
                    <span aria-hidden="true">★</span>
                    {isElite ? "Featured" : "Featured"}
                  </span>
                )}

                {isPrivate && (
                  <span className="inline-flex items-center rounded-full bg-slate-900 text-white px-2 py-0.5 text-[10px] font-black uppercase tracking-widest">
                    Invite only
                  </span>
                )}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-bold text-slate-600">
                <span className="inline-flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-4.35 7-11a7 7 0 10-14 0c0 6.65 7 11 7 11z" />
                    <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 10a2 2 0 110-4 2 2 0 010 4z" />
                  </svg>
                  <span className="truncate">{remoteMeta}</span>
                </span>
                {timeAgo && (
                  <span className="inline-flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
                      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M22 12a10 10 0 11-20 0 10 10 0 0120 0z" />
                    </svg>
                    <span>{timeAgo}</span>
                  </span>
                )}
                {job.companyVerified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                    Verified
                  </span>
                )}
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
              {showSave && onToggleSave && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSave();
                  }}
                  className={[
                    "h-11 w-11 rounded-2xl border flex items-center justify-center transition-colors",
                    isSaved
                      ? "bg-pink-50 border-pink-200 text-pink-600"
                      : "bg-white border-slate-200/70 text-slate-400 hover:text-pink-500 hover:border-pink-200",
                  ].join(" ")}
                  aria-pressed={isSaved ? "true" : "false"}
                  aria-label={isSaved ? "Unsave role" : "Save role"}
                  title={isSaved ? "Saved" : "Save"}
                >
                  <svg
                    className="w-5 h-5"
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

              {showMenu && (
              <div className="relative hidden sm:block">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen((prev) => !prev);
                  }}
                  className="h-11 w-11 rounded-2xl border border-slate-200/70 bg-white text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-colors flex items-center justify-center"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen ? "true" : "false"}
                  aria-label="More actions"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </button>

                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 mt-2 w-44 rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden z-30"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      role="menuitem"
                      className="w-full text-left px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 border-b border-slate-100"
                      onClick={async () => {
                        setMenuOpen(false);
                        if (onAction) onAction("copy_link");
                        try {
                          await navigator.clipboard.writeText(window.location.origin + href);
                        } catch {
                          // ignore
                        }
                      }}
                    >
                      Copy link
                    </button>
                    <button
                      role="menuitem"
                      className="w-full text-left px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
                      onClick={() => {
                        setMenuOpen(false);
                        if (onAction) onAction("open_new_tab");
                        window.open(href, "_blank", "noopener,noreferrer");
                      }}
                    >
                      Open details
                    </button>
                  </div>
                )}
              </div>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0 flex items-center gap-2 flex-wrap">
              {chips.slice(0, 3).map((chip) => (
                <span
                  key={chip}
                  className="inline-flex items-center rounded-full bg-white border border-slate-200/70 px-2 py-1 text-[11px] font-bold text-slate-700"
                >
                  {chip}
                </span>
              ))}
              {stack.length > 2 && (
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">
                  +{stack.length - 2}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto justify-between sm:justify-start">
              <div className="flex-1 min-w-0">
                <span className="block truncate text-[12px] sm:text-sm font-black text-slate-900">
                  {job.salary || "Salary listed"}
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onApply();
                }}
                className={[
                  "h-11",
                  "px-4 text-[10px] sm:px-5 sm:text-[11px]",
                  "min-w-[124px] sm:min-w-[132px] flex-shrink-0 whitespace-nowrap",
                  "rounded-2xl bg-indigo-600 text-white font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-100",
                ].join(" ")}
              >
                Quick apply
              </button>
            </div>
          </div>

          {expanded && (
            <div className="sm:hidden mt-3 pt-3 border-t border-amber-200/60">
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <span className="inline-flex items-center rounded-full bg-white border border-slate-200/70 px-2 py-1">
                  {workMode}
                </span>
                <span className="inline-flex items-center rounded-full bg-white border border-slate-200/70 px-2 py-1">
                  {job.type}
                </span>
                <span className="inline-flex items-center rounded-full bg-white border border-slate-200/70 px-2 py-1">
                  {job.category}
                </span>
                {job.companyVerified && (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2 py-1 text-emerald-700">
                    Verified
                  </span>
                )}
              </div>

              {descriptionPreview && (
                <p className="mt-3 text-sm font-medium text-slate-600 leading-relaxed">
                  {descriptionPreview}
                </p>
              )}

              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (job.applyUrl && job.applyUrl !== "#") {
                      onApply();
                      return;
                    }
                    router.push(href);
                  }}
                  className="h-11 flex-1 rounded-2xl border border-slate-200/80 bg-white text-[10px] font-black uppercase tracking-widest text-slate-700 hover:border-indigo-200 hover:text-indigo-700"
                >
                  Full details
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect();
                  }}
                  className="h-11 px-4 rounded-2xl border border-slate-200/80 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

