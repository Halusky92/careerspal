"use client";

import Link from "next/link";
import { Job } from "../types";
import CompanyLogo from "./CompanyLogo";
import { createJobSlug } from "../lib/jobs";
import { formatSalaryDisplay } from "../lib/formatSalary";

const getWorkMode = (job: Job) => {
  const policy = (job.remotePolicy || "").toLowerCase();
  const loc = (job.location || "").toLowerCase();
  if (policy.includes("hybrid") || loc.includes("hybrid")) return "Hybrid";
  if (policy.includes("remote") || /\bremote\b/.test(loc)) return "Remote";
  return loc ? "Onsite" : "Remote";
};

export default function HomePreviewCard({ job }: { job: Job }) {
  const href = `/jobs/${createJobSlug({ id: job.id, title: job.title || "role" })}`;
  const featured = job.planType === "Elite Managed" || job.planType === "Featured Pro";
  const place = getWorkMode(job);

  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 hover:border-slate-300 hover:shadow-sm transition-all"
    >
      <div className="w-9 h-9 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0">
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
          {featured ? <span className="h-1.5 w-1.5 rounded-full bg-amber-400 flex-shrink-0" aria-hidden /> : null}
          <h3 className="truncate text-sm font-semibold text-slate-900 group-hover:text-indigo-700">
            {job.title}
          </h3>
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {job.company} · {place}
        </p>
        <p className="sm:hidden mt-0.5 text-xs font-semibold tabular-nums text-slate-900">
          {formatSalaryDisplay(job.salary)}
        </p>
      </div>
      <p className="hidden sm:block flex-shrink-0 text-sm font-semibold tabular-nums text-slate-900 whitespace-nowrap">
        {formatSalaryDisplay(job.salary)}
      </p>
    </Link>
  );
}
