"use client";

import Link from "next/link";
import { Job } from "../types";
import CompanyLogo from "./CompanyLogo";
import { createJobSlug } from "../lib/jobs";
import { formatJobSalary } from "../lib/formatSalary";
import { inferWorkMode, publicLocationLabel } from "../lib/workMode";
import { isPaidFeaturedListing } from "../lib/featuredListing";
import FeaturedBadge from "./FeaturedBadge";
import NewListingBadge from "./NewListingBadge";
import PremiumWindowBadge from "./PremiumWindowBadge";
import { isEarlyAccessListing, isNewListing } from "../lib/listingWindow";
import { publicPostedLabel } from "../lib/formatPosted";

const getWorkMode = (job: Job) => inferWorkMode(job);

export default function HomePreviewCard({
  job,
  isSaved = false,
  onToggleSave,
}: {
  job: Job;
  isSaved?: boolean;
  onToggleSave?: () => void;
}) {
  const href = `/jobs/${createJobSlug({ id: job.id, title: job.title || "role" })}`;
  const featured = isPaidFeaturedListing(job);
  const isEarly = isEarlyAccessListing(job);
  const isNew = isNewListing(job);
  const elite = job.planType === "Elite Managed";
  const place = getWorkMode(job);
  const timeAgo = publicPostedLabel(job.timestamp, job.postedAt);

  return (
    <div
      className={[
        "group relative flex items-center gap-3 rounded-xl border px-3 py-2.5 hover:shadow-sm transition-all overflow-hidden",
        featured
          ? elite
            ? "border-slate-900/20 bg-white"
            : "border-indigo-200 bg-white"
          : isEarly
            ? "border-[#c6a15b] bg-[#fbf8f2]"
            : isNew
              ? "border-[#efe6d4] bg-[#fbf8f2]"
              : "border-slate-200 bg-white hover:border-slate-300",
      ].join(" ")}
    >
      {featured ? (
        <span aria-hidden className={["absolute inset-y-0 left-0 w-1", elite ? "bg-slate-900" : "bg-indigo-500"].join(" ")} />
      ) : null}
      <Link href={href} className="flex min-w-0 flex-1 items-center gap-3">
        <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
          <CompanyLogo
            name={job.company}
            logoUrl={job.logo}
            website={job.companyWebsite || job.applyUrl}
            className="w-full h-full"
            imageClassName="w-full h-full object-contain bg-white"
            fallbackClassName="text-[9px]"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-900 group-hover:text-indigo-700">
              {job.title}
            </h3>
            {isEarly ? <PremiumWindowBadge job={job} /> : <NewListingBadge job={job} />}
            <FeaturedBadge job={job} />
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
            {job.company} · {publicLocationLabel(job) || place}
            {timeAgo ? ` · ${timeAgo}` : ""}
          </p>
          <p className="sm:hidden mt-0.5 text-xs font-semibold tabular-nums text-slate-900">
            {formatJobSalary(job)}
          </p>
        </div>
        <p className="hidden sm:block flex-shrink-0 text-sm font-semibold tabular-nums text-slate-900 whitespace-nowrap">
          {formatJobSalary(job)}
        </p>
      </Link>
      {onToggleSave ? (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggleSave();
          }}
          className={[
            "flex h-9 w-9 shrink-0 items-center justify-center bg-transparent",
            isSaved ? "text-red-700" : "text-slate-400 hover:text-red-700",
          ].join(" ")}
          aria-pressed={isSaved ? "true" : "false"}
          aria-label={isSaved ? "Unsave role" : "Save role"}
          title={isSaved ? "Saved" : "Save"}
        >
          <svg className="w-4 h-4" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
