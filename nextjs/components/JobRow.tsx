"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Job } from "../types";
import CompanyLogo from "./CompanyLogo";
import { createCompanySlug, createJobSlug } from "../lib/jobs";
import { rolePreviewBullets } from "../lib/sourcing/normalization/description";
import { formatJobSalary } from "../lib/formatSalary";
import { visiblePostingTools } from "../lib/postingTools";
import { inferWorkMode, publicLocationLabel } from "../lib/workMode";
import { publicCategoryLabel } from "../lib/categories";
import { isPaidFeaturedListing } from "../lib/featuredListing";
import FeaturedBadge from "./FeaturedBadge";
import NewListingBadge from "./NewListingBadge";
import { isNewListing, listingAgeBadge } from "../lib/listingWindow";
import { publicPostedLabel } from "../lib/formatPosted";

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
  onOpenRole?: () => void;
};

const getWorkMode = (job: Job) => inferWorkMode(job);

const formatTimeAgo = (job: Job) => publicPostedLabel(job.timestamp, job.postedAt);

const getRemoteMeta = (job: Job, workMode: string) => {
  const shown = publicLocationLabel(job);
  if (shown) return shown;
  if (workMode === "Remote" || workMode === "Hybrid") return `${workMode} • Not specified`;
  return workMode ? "Onsite" : "";
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
  onOpenRole,
}: JobRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const rawSlug = (job.companySlug || "").toString().trim();
  const safeSlug = rawSlug && rawSlug !== "undefined" && rawSlug !== "null" ? rawSlug : "";
  const companyHref = `/companies/${(safeSlug || createCompanySlug({ name: job.company || "Company" })).trim()}`;

  const isElite = job.planType === "Elite Managed";
  const isBoosted = isPaidFeaturedListing(job);
  const isNew = isNewListing(job);
  const ageBadge = listingAgeBadge(job);
  const isPrivate = job.status === "private" || job.status === "invite_only";
  const workMode = useMemo(() => getWorkMode(job), [job]);
  const timeAgo = useMemo(() => formatTimeAgo(job), [job.timestamp, job.postedAt]);
  const stack = useMemo(() => {
    const fromText = visiblePostingTools(job.tools, job.description || "");
    if (fromText.length || (job.description || "").trim()) return fromText;
    return (job.tools || []).filter(Boolean).slice(0, 12);
  }, [job.description, job.tools]);

  // Keep board panel UX (query param) intact, but canonicalize share/open links.
  const boardHref = `/jobs?jobId=${encodeURIComponent(job.id)}`;
  const detailHref = `/jobs/${createJobSlug({ id: job.id, title: job.title || "role" })}`;

  const isHome = variant === "home";
  const previewBullets = useMemo(() => {
    if (!expanded) return [];
    const fromText = rolePreviewBullets(job.description || "");
    if (fromText.length || (job.description || "").trim()) return fromText;
    return job.preview || [];
  }, [expanded, job.description, job.preview]);
  const remoteMeta = useMemo(
    () => getRemoteMeta(job, workMode),
    [job.location, job.remotePolicy, job.title, job.description, workMode],
  );

  const chips = useMemo(() => {
    // Scan-first metadata.
    // - board: minimal chips (type)
    // - home: salary-first + category visibility (no tool noise)
    const typeChip = job.type && job.type !== "Unknown" ? job.type : null;
    if (variant === "board") return typeChip ? [typeChip] : [];
    const out: string[] = [];
    const categoryLabel = publicCategoryLabel(job);
    if (categoryLabel) out.push(categoryLabel);
    if (typeChip) out.push(typeChip);
    return out.slice(0, 2);
  }, [job.type, job.category, job.title, variant]);

  const toolList = useMemo(() => (stack || []).filter(Boolean), [stack]);

  return (
    <div
      className={[
        "group relative rounded-xl border transition-all",
        menuOpen ? "z-30 overflow-visible" : "overflow-hidden",
        isBoosted
          ? isElite
            ? "bg-white border-slate-900/20 shadow-sm"
            : "bg-white border-indigo-200 shadow-sm"
          : isNew
            ? "bg-[#fbf8f2] border-[#efe6d4]"
            : "bg-white border-slate-200",
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
      {isBoosted && (
        <div
          aria-hidden="true"
          className={["absolute inset-y-0 left-0 w-1", isElite ? "bg-slate-900" : "bg-indigo-500"].join(" ")}
        />
      )}
      {ageBadge ? (
        <span className="absolute top-2 left-2 z-10">
          <NewListingBadge job={job} />
        </span>
      ) : null}
      <div className="flex items-start gap-2 px-3 py-1.5 lg:gap-2.5 lg:py-2">
        <div
          className={[
            "rounded-xl overflow-hidden bg-white border border-slate-200/70 p-0.5 flex-shrink-0 lg:rounded-2xl lg:p-1",
            ageBadge ? "mt-4 lg:mt-5" : "mt-0.5",
            isHome ? "w-9 h-9 lg:w-10 lg:h-10" : "w-9 h-9 lg:w-11 lg:h-11",
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
              <h3 className="text-[14px] sm:text-[15px] font-bold text-slate-900 leading-snug line-clamp-2">
                <Link
                  href={detailHref}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenRole?.();
                  }}
                  className="block hover:text-indigo-700 hover:underline decoration-indigo-300 underline-offset-2 relative z-10"
                  title="Open role page"
                >
                  {job.title}
                </Link>
              </h3>

              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-semibold text-slate-700">
                <a
                  className="hover:text-indigo-600 hover:underline decoration-indigo-300 underline-offset-2 truncate"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onOpenCompany) {
                      onOpenCompany(job.company);
                      return;
                    }
                    // Let the anchor navigate.
                  }}
                  title={job.company}
                  href={companyHref}
                >
                  {job.company}
                </a>

                <FeaturedBadge job={job} />

                {isPrivate && (
                  <span className="inline-flex items-center rounded-full bg-slate-900 text-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                    Invite only
                  </span>
                )}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-medium text-slate-700">
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
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                    Verified
                  </span>
                )}
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
                    "flex h-8 w-8 items-center justify-center bg-transparent lg:h-11 lg:w-11",
                    isSaved ? "text-red-700" : "text-slate-400 hover:text-red-700",
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
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/70 bg-white text-slate-500 transition-colors hover:border-indigo-200 hover:text-indigo-600 lg:h-11 lg:w-11 lg:rounded-2xl"
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
                    className="absolute right-0 top-full z-40 mt-1.5 w-44 rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      role="menuitem"
                      className="w-full px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                      onClick={async () => {
                        setMenuOpen(false);
                        if (onAction) onAction("copy_link");
                        try {
                          await navigator.clipboard.writeText(window.location.origin + detailHref);
                        } catch {
                          // ignore
                        }
                      }}
                    >
                      Copy link
                    </button>
                    <button
                      role="menuitem"
                      className="w-full px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                      onClick={() => {
                        setMenuOpen(false);
                        if (onAction) onAction("open_new_tab");
                        window.open(detailHref, "_blank", "noopener,noreferrer");
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

          <div className="mt-1.5 flex items-center justify-between gap-2 lg:mt-3">
            <div className="min-w-0 flex items-center gap-2 flex-wrap">
              {chips.slice(0, 3).map((chip) => (
                <span
                  key={chip}
                  className="inline-flex items-center rounded-full bg-white border border-slate-200/70 px-2 py-0.5 text-[11px] font-bold text-slate-700 lg:py-1"
                >
                  {chip}
                </span>
              ))}
              <span className="truncate text-[12px] font-bold text-slate-900 lg:hidden">
                {formatJobSalary(job)}
              </span>
              {variant !== "board" && toolList.length > 2 && (
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  +{toolList.length - 2}
                </span>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden truncate text-sm font-bold text-slate-900 lg:block">
                {formatJobSalary(job)}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onApply();
                }}
                className="h-8 flex-shrink-0 whitespace-nowrap rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white transition-colors hover:bg-indigo-700 active:bg-indigo-800 lg:h-9 lg:px-4"
              >
                Apply
              </button>
            </div>
          </div>

          {expanded && (
            <div className="mt-3 border-t border-slate-200 pt-3 sm:hidden">
              {previewBullets.length > 0 ? (
                <ul className="space-y-1.5">
                  {previewBullets.map((line) => (
                    <li key={line} className="flex gap-2 text-[13px] font-normal leading-5 text-slate-700">
                      <span className="mt-[0.55rem] h-1 w-1 shrink-0 rounded-full bg-slate-400" aria-hidden="true" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <Link
                href={detailHref}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenRole?.();
                }}
                className="mt-3 inline-flex text-sm font-medium text-indigo-700 hover:text-indigo-800"
              >
                View role
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

