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

const formatPosted = (job: Job) => {
  if (!job.timestamp) return job.postedAt;
  const date = new Date(job.timestamp);
  return Number.isNaN(date.getTime()) ? job.postedAt : date.toLocaleDateString();
};

export default function JobRow({
  job,
  variant = "board",
  selected = false,
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
  const posted = useMemo(() => formatPosted(job), [job.timestamp, job.postedAt]);
  const stack = useMemo(() => {
    const tools = (job.tools || []).filter(Boolean);
    if (tools.length > 0) return tools;
    return (job.tags || []).filter(Boolean);
  }, [job.tags, job.tools]);

  const href = `/jobs/${createJobSlug(job)}`;

  const isHome = variant === "home";

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
    >
      {(isElite || isPro) && (
        <div
          className={[
            "absolute -top-2 left-4 px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm",
            isElite ? "bg-yellow-200 text-yellow-900" : "bg-indigo-600 text-white",
          ].join(" ")}
        >
          {isElite ? "Elite Managed" : "Featured"}
        </div>
      )}

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
              <div className="flex items-center gap-2 min-w-0">
                <h3 className={[isHome ? "text-sm" : "text-sm sm:text-base", "font-black text-slate-900 truncate"].join(" ")}>
                  {job.title}
                </h3>
                {isPrivate && (
                  <span className="hidden sm:inline-flex items-center rounded-full bg-slate-900 text-white px-2 py-0.5 text-[8px] font-black uppercase tracking-widest">
                    Invite only
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold text-slate-500">
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
                >
                  {job.company}
                </button>
                <span className="text-slate-300">•</span>
                <span className="truncate">{job.location}</span>
                <span className="text-slate-300">•</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white border border-slate-200/70 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-slate-500">
                  {workMode}
                </span>
                <span className="text-slate-300">•</span>
                <span className="truncate">{job.salary}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
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
              <div className="relative">
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

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="min-w-0 flex items-center gap-2 flex-wrap">
              {(stack || []).slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full bg-white border border-slate-200/70 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-500"
                >
                  {tag}
                </span>
              ))}
              {stack.length > 4 && (
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  +{stack.length - 4}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="hidden sm:inline-flex items-center rounded-full bg-white border border-slate-200/70 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
                Posted {posted}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onApply();
                }}
                className={[
                  isHome ? "h-10 px-4 text-[10px]" : "h-11 px-5 text-[11px]",
                  "rounded-2xl bg-indigo-600 text-white font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-100",
                ].join(" ")}
              >
                Quick apply
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

