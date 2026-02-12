"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Job } from "../types";
import { createJobSlug } from "../lib/jobs";

type JobMiniCardProps = {
  job: Job;
  className?: string;
};

export default function JobMiniCard({ job, className = "" }: JobMiniCardProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push(`/jobs/${createJobSlug(job)}`)}
      className={[
        "w-full text-left rounded-2xl border border-amber-200 bg-amber-50/50 hover:bg-amber-50/70 shadow-sm hover:shadow-md transition-all px-4 py-3",
        "flex items-center gap-4 justify-between",
        "active:scale-[0.99]",
        className,
      ].join(" ")}
    >
      <div className="min-w-0">
        <div className="text-sm font-black text-slate-900 truncate">{job.title}</div>
      </div>

      <div className="flex-shrink-0 text-[11px] font-black text-slate-900 whitespace-nowrap">
        {job.salary}
      </div>
    </button>
  );
}

