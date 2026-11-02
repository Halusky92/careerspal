'use client';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Hero from "../components/Hero";
import HomePreviewCard from "../components/HomePreviewCard";
import { Job } from "../types";
import { isOnNicheJob } from "../lib/nicheScope";

const planWeight = { "Elite Managed": 3, "Featured Pro": 2, Standard: 1 };

export default function HomeClient({ initialJobs }: { initialJobs: Job[] }) {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>(() => initialJobs || []);
  const [jobsLoading, setJobsLoading] = useState(() => (initialJobs?.length ? false : true));
  const [isSmUp, setIsSmUp] = useState(false);

  useEffect(() => {
    const loadJobs = async () => {
      try {
        const response = await fetch("/api/jobs");
        const data = (await response.json()) as { jobs?: Job[] };
        if (Array.isArray(data.jobs)) {
          setJobs(data.jobs);
        }
      } catch {
        // keep fallback
      } finally {
        setJobsLoading(false);
      }
    };
    loadJobs();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 640px)");
    const update = () => setIsSmUp(mq.matches);
    update();
    try {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    } catch {
      mq.addListener(update);
      return () => mq.removeListener(update);
    }
  }, []);

  const previewJobs = useMemo(() => {
    const sorted = [...jobs]
      .filter((job) => isOnNicheJob(job))
      .sort((a, b) => {
        const weightA = planWeight[a.planType || "Standard"] || 1;
        const weightB = planWeight[b.planType || "Standard"] || 1;
        if (weightA !== weightB) return weightB - weightA;
        return (b.timestamp ?? 0) - (a.timestamp ?? 0);
      });
    return sorted.slice(0, isSmUp ? 4 : 3);
  }, [jobs, isSmUp]);

  const hasJobs = jobs.length > 0;

  return (
    <>
      <Hero onBrowse={() => router.push("/jobs")} onGetAlerts={() => router.push("/alerts")} />

      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold text-slate-900">A few live roles</h2>
          {!jobsLoading && hasJobs ? (
            <button type="button" onClick={() => router.push("/jobs")} className="text-sm font-medium text-indigo-600">
              See all {jobs.length}
            </button>
          ) : (
            <button type="button" onClick={() => router.push("/jobs")} className="text-sm font-medium text-indigo-600">
              Browse jobs
            </button>
          )}
        </div>

        {jobsLoading && (
          <div className="space-y-2">
            <div className="h-14 rounded-xl bg-slate-100" />
            <div className="h-14 rounded-xl bg-slate-100" />
            <div className="h-14 rounded-xl bg-slate-100" />
          </div>
        )}

        {!jobsLoading && !hasJobs && (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center">
            <p className="text-sm font-medium text-slate-900">No live roles right now.</p>
            <p className="mt-1 text-sm text-slate-500">Get an email when a new one is published.</p>
            <button
              type="button"
              onClick={() => router.push("/alerts")}
              className="mt-4 h-10 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium"
            >
              Get alerts
            </button>
          </div>
        )}

        {!jobsLoading && hasJobs && (
          <div className="space-y-2">
            {previewJobs.map((job) => (
              <HomePreviewCard key={job.id} job={job} />
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => router.push("/jobs")}
          className="mt-4 w-full h-11 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-800 hover:border-indigo-200 hover:text-indigo-700"
        >
          {hasJobs ? `See all ${jobs.length} jobs` : "Browse jobs"}
        </button>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <span>Salary-first listings</span>
          <span className="hidden sm:inline text-slate-300">·</span>
          <button type="button" onClick={() => router.push("/alerts")} className="hover:text-indigo-700">
            Daily alerts
          </button>
          <span className="hidden sm:inline text-slate-300">·</span>
          <button type="button" onClick={() => router.push("/post-a-job")} className="hover:text-indigo-700">
            Post a job
          </button>
        </div>
      </section>
    </>
  );
}
