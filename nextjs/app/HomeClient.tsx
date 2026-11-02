'use client';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Hero from "../components/Hero";
import { Job } from "../types";
import JobRow from "../components/JobRow";
import { isOnNicheJob } from "../lib/nicheScope";

const planWeight = { "Elite Managed": 3, "Featured Pro": 2, Standard: 1 };

export default function HomeClient({ initialJobs }: { initialJobs: Job[] }) {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>(() => initialJobs || []);
  const [jobsLoading, setJobsLoading] = useState(() => (initialJobs?.length ? false : true));
  const [isSmUp, setIsSmUp] = useState(false);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

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

  const topJobs = useMemo(() => {
    return [...jobs].sort((a, b) => {
      const weightA = planWeight[a.planType || "Standard"] || 1;
      const weightB = planWeight[b.planType || "Standard"] || 1;
      if (weightA !== weightB) return weightB - weightA;
      return (b.timestamp ?? 0) - (a.timestamp ?? 0);
    });
  }, [jobs]);

  const filteredTopJobs = useMemo(() => topJobs.filter((j) => isOnNicheJob(j)), [topJobs]);

  const hasJobs = jobs.length > 0;
  const showJobCounts = !jobsLoading && hasJobs;
  const companyCount = useMemo(() => new Set(jobs.map((job) => job.company)).size, [jobs]);
  const rolesLast7Days = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return jobs.filter((job) => (job.timestamp ?? 0) >= cutoff).length;
  }, [jobs]);
  const lastUpdatedText = useMemo(() => {
    const maxTs = jobs.reduce((max, job) => Math.max(max, job.timestamp ?? 0), 0);
    if (!maxTs) return null;
    try {
      return new Date(maxTs).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return null;
    }
  }, [jobs]);

  const handleApply = async (job: Job) => {
    const isPrivate = job.status === "private" || job.status === "invite_only";
    const hasApplyUrl = Boolean(job.applyUrl && job.applyUrl.trim() && job.applyUrl !== "#");
    if (isPrivate) {
      router.push("/auth");
      return;
    }
    if (!hasApplyUrl) {
      alert("Apply link is not available yet.");
      return;
    }
    try {
      await fetch(`/api/jobs/${job.id}/match`, { method: "POST" });
    } catch {
      // no-op
    }
    window.open(job.applyUrl, "_blank", "noopener,noreferrer");
  };

  const goToAlerts = () => {
    router.push("/alerts");
  };

  return (
    <>
      <Hero onBrowse={() => router.push("/jobs")} onGetAlerts={goToAlerts} />

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Open roles
            {showJobCounts ? <span className="ml-2 font-normal text-slate-500">{jobs.length} live</span> : null}
          </h2>
          <button type="button" onClick={() => router.push("/jobs")} className="text-sm font-medium text-indigo-600">
            View all
          </button>
        </div>

          {jobsLoading && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="h-6 w-64 bg-slate-100 rounded-xl mb-3"></div>
              <div className="h-4 w-96 max-w-full bg-slate-100 rounded-xl mb-8"></div>
              <div className="space-y-3">
                <div className="h-20 bg-slate-100 rounded-2xl"></div>
                <div className="h-20 bg-slate-100 rounded-2xl"></div>
                <div className="h-20 bg-slate-100 rounded-2xl"></div>
              </div>
            </div>
          )}

          {!jobsLoading && !hasJobs && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
              <div className="text-base font-semibold text-slate-900">New roles are reviewed regularly.</div>
              <p className="text-sm text-slate-600 mt-1">
                Browse the board, or post a role with a clear salary range.
              </p>
              <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => router.push("/jobs")}
                  className="px-6 py-3 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-black"
                >
                  Browse jobs
                </button>
                <button
                  onClick={() => router.push("/post-a-job")}
                  className="px-6 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-widest hover:border-indigo-200 hover:text-indigo-700"
                >
                  Post a job
                </button>
              </div>
            </div>
          )}

          {hasJobs && (
            <div className="space-y-2">
                {filteredTopJobs.slice(0, 7).map((job) => (
                  <JobRow
                    key={job.id}
                    job={job}
                    variant="home"
                    expanded={!isSmUp && expandedJobId === job.id}
                    showSave={false}
                    showMenu={false}
                    onSelect={() => {
                      if (isSmUp) {
                        router.push(`/jobs?jobId=${encodeURIComponent(job.id)}`);
                        return;
                      }
                      setExpandedJobId((prev) => (prev === job.id ? null : job.id));
                    }}
                    onApply={() => handleApply(job)}
                  />
                ))}

                {filteredTopJobs.length === 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white p-5 text-center text-sm text-slate-600">
                    No live roles in this niche yet.
                  </div>
                )}
            </div>
          )}

          <button
            onClick={() => router.push("/jobs")}
            className="mt-3 w-full h-10 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:border-indigo-200 hover:text-indigo-700"
          >
            {hasJobs ? `View all ${jobs.length} jobs` : "Browse jobs"}
          </button>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6 space-y-3">
        {showJobCounts && (
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600 border border-slate-200 rounded-lg bg-white px-4 py-2.5">
            <span><strong className="text-slate-900">{jobs.length}</strong> live roles</span>
            <span><strong className="text-slate-900">{companyCount}</strong> teams</span>
            <span><strong className="text-slate-900">{rolesLast7Days}</strong> added (7d)</span>
            {lastUpdatedText ? <span className="text-slate-400">Updated {lastUpdatedText}</span> : null}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <div className="font-medium text-slate-900">Salary required</div>
            <p className="text-slate-500">Visible range before publish.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <div className="font-medium text-slate-900">Get alerts</div>
            <button type="button" onClick={() => router.push("/alerts")} className="text-indigo-600">
              New roles by email
            </button>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <div className="font-medium text-slate-900">Hiring for Ops?</div>
            <button type="button" onClick={() => router.push("/post-a-job")} className="text-indigo-600">
              Post a job
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

