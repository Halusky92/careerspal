"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Job } from "../types";
import { createJobSlug } from "../lib/jobs";
import CompanyLogo from "./CompanyLogo";

type JobMiniCardProps = {
  job: Job;
  className?: string;
};

export default function JobMiniCard({ job, className = "" }: JobMiniCardProps) {
  const router = useRouter();

  const isElite = job.planType === "Elite Managed";
  const isPro = job.planType === "Featured Pro";
  const isNew = (job.postedAt || "").toLowerCase().includes("just now");

  return (
    <button
      type="button"
      onClick={() => router.push(`/jobs/${createJobSlug(job)}`)}
      className={[
        "w-full text-left rounded-2xl border border-amber-200 bg-amber-50/50 hover:bg-amber-50/70 shadow-sm hover:shadow-md transition-all px-4 py-3",
        "flex items-center gap-3 justify-between",
        "active:scale-[0.99]",
        className,
      ].join(" ")}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-10 h-10 rounded-xl p-1 flex items-center justify-center border ${
            isElite ? "bg-yellow-100 border-yellow-200" : "bg-white border-slate-100"
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
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="text-sm font-black text-slate-900 truncate">{job.title}</div>
            {(isElite || isPro) && (
              <span
                className={`flex-shrink-0 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                  isElite
                    ? "bg-yellow-200 text-yellow-900 border-yellow-200"
                    : "bg-indigo-600 text-white border-indigo-600"
                }`}
              >
                {isElite ? "Elite" : "Featured"}
              </span>
            )}
            {isNew && (
              <span className="flex-shrink-0 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-red-500 text-white">
                New
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 truncate">
            {job.company} • {job.location}
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 text-[11px] font-black text-slate-900 whitespace-nowrap">
        {job.salary}
      </div>
    </button>
  );
}

