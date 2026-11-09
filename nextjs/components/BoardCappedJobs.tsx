import Link from "next/link";
import { Job } from "../types";
import { createJobSlug } from "../lib/jobs";
import { formatJobSalary } from "../lib/formatSalary";

export default function BoardCappedJobs({
  jobs,
  variant,
}: {
  jobs: Job[];
  variant: "company" | "category";
}) {
  if (jobs.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
        <p className="text-sm text-slate-600">No live roles here right now.</p>
        <Link href="/jobs" className="mt-3 inline-flex text-sm font-medium text-indigo-700">
          Browse jobs
        </Link>
      </div>
    );
  }

  if (variant === "category") {
    return (
      <ul className="mt-6 space-y-3">
        {jobs.map((job) => {
          const href = `/jobs/${createJobSlug({ id: job.id, title: job.title || "role" })}`;
          return (
            <li
              key={job.id}
              className="rounded-3xl border border-slate-200/60 bg-white px-5 py-5 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors"
            >
              <Link href={href} className="block text-base sm:text-lg font-black text-slate-900 hover:text-indigo-700">
                {job.title}
              </Link>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-bold text-slate-600">
                <span className="truncate">{job.company}</span>
                {job.location ? (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="truncate">{job.location}</span>
                  </>
                ) : null}
              </div>
              <div className="mt-2 text-sm font-medium text-slate-900">{formatJobSalary(job)}</div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className="mt-3 space-y-2">
      {jobs.map((job) => {
        const href = `/jobs/${createJobSlug({ id: job.id, title: job.title || "role" })}`;
        return (
          <li key={job.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 hover:border-indigo-200">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Link href={href} className="block text-sm font-semibold text-slate-900 hover:text-indigo-700 truncate">
                  {job.title}
                </Link>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] text-slate-500">
                  {job.location && <span className="truncate">{job.location}</span>}
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <div className="text-sm font-medium text-slate-900 whitespace-nowrap">{formatJobSalary(job)}</div>
                <Link href={href} className="mt-1 inline-flex text-xs font-medium text-indigo-700 hover:underline">
                  View role
                </Link>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
