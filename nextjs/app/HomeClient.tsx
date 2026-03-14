'use client';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Hero from "../components/Hero";
import { Job } from "../types";
import JobRow from "../components/JobRow";

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

  const goToJobsWithQuery = (query?: string) => {
    const q = (query ?? "").trim();
    router.push(q ? `/jobs?query=${encodeURIComponent(q)}` : "/jobs");
  };

  const goToJobsWithCategory = (category: string) => {
    router.push(`/jobs?category=${encodeURIComponent(category)}`);
  };

  return (
    <>
      {/* 2) Hero */}
      <Hero onBrowse={() => router.push("/jobs")} onGetAlerts={goToAlerts} />

      {/* 3) Top category quick nav */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 pb-10">
        <div className="rounded-[2.5rem] border border-slate-200/60 bg-white/85 backdrop-blur p-6 sm:p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Browse by focus</div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 mt-2">Start with a lane.</div>
              <div className="mt-2 text-sm text-slate-600 font-medium">
                Most roles are Notion-heavy — but the board stays broad across Ops, Systems, Automation, RevOps, Product Ops, and Chief of Staff.
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.push("/jobs")}
              className="hidden sm:inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-indigo-200 hover:text-indigo-700"
            >
              View all jobs →
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Notion Ops", onClick: () => goToJobsWithQuery("Notion") },
              { label: "Operations", onClick: () => goToJobsWithCategory("Operations") },
              { label: "Systems", onClick: () => goToJobsWithCategory("Systems Design") },
              { label: "Automation", onClick: () => goToJobsWithCategory("Automation") },
              { label: "RevOps", onClick: () => goToJobsWithQuery("RevOps") },
              { label: "Product Ops", onClick: () => goToJobsWithQuery("Product Ops") },
              { label: "Chief of Staff", onClick: () => goToJobsWithQuery("Chief of Staff") },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                className="rounded-2xl border border-slate-200/70 bg-white px-4 py-4 text-left hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors"
              >
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Focus</div>
                <div className="mt-1 text-sm font-black text-slate-900">{item.label}</div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 4) Featured roles preview */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-14">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 px-1">
            <div>
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em]">Featured roles</p>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
                {hasJobs ? "Notion-heavy, salary-first roles worth your time." : "Notion-heavy remote roles, salary-first."}
              </h2>
              <p className="text-sm text-slate-600 font-medium mt-2 max-w-2xl">
                Title, company, salary, remote/location, category, and posted date — easy to scan.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {showJobCounts && (
                <span className="hidden sm:inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
                  {jobs.length} live roles{lastUpdatedText ? ` • Updated ${lastUpdatedText}` : ""}
                </span>
              )}
              <button
                type="button"
                onClick={() => router.push("/jobs")}
                className="h-10 px-4 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-black"
              >
                Browse jobs
              </button>
            </div>
          </div>

          {jobsLoading && (
            <div className="rounded-[2.5rem] border border-slate-200/70 bg-white p-10 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
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
            <div className="rounded-[2.5rem] border border-slate-200/70 bg-white p-10 text-center shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
              <div className="text-2xl font-black text-slate-900">New roles are reviewed regularly.</div>
              <p className="text-sm text-slate-600 font-medium mt-2">
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
            <div className="space-y-4">
              {topJobs.slice(0, 7).map((job) => (
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
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={() => router.push("/jobs")}
              className="w-full py-4 rounded-[2rem] bg-white border-2 border-slate-100 text-slate-700 font-black uppercase tracking-widest text-[10px] hover:border-indigo-200 hover:text-indigo-700 transition-colors shadow-sm"
            >
              {hasJobs ? `View all ${jobs.length} jobs →` : "Browse jobs →"}
            </button>
          </div>
        </div>
      </section>

      {/* 5) How curation works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        <div className="rounded-[2.5rem] border border-slate-200/60 bg-white/70 backdrop-blur p-6 sm:p-8 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">How curation works</p>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">Every role is reviewed before it goes live.</h3>
              <p className="text-slate-500 font-medium mt-2 max-w-2xl">
                We prioritize salary clarity, scope clarity, and remote constraints you can trust.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: "Review", copy: "We tighten scope, remove ambiguity, and require a salary range." },
              { title: "Verify", copy: "We validate basic legitimacy signals when possible." },
              { title: "Rank", copy: "We surface roles by category + remote constraints for fast scanning." },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-white rounded-[1.8rem] border border-slate-200/60 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.06)]"
              >
                <div className="text-[11px] font-black uppercase tracking-widest text-indigo-500">{item.title}</div>
                <p className="text-sm text-slate-500 font-medium mt-2">{item.copy}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-[1.8rem] border border-slate-200/60 bg-white p-5">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">What we reject</div>
            <ul className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-slate-600 font-medium">
              <li className="flex items-center gap-2"><span className="text-rose-500 font-black">×</span> No salary range</li>
              <li className="flex items-center gap-2"><span className="text-rose-500 font-black">×</span> Vague scope / responsibilities</li>
              <li className="flex items-center gap-2"><span className="text-rose-500 font-black">×</span> Low-signal spam listings</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 6) Alerts CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="rounded-[3rem] border border-slate-200/60 bg-white/85 backdrop-blur p-8 sm:p-12 shadow-[0_18px_55px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500">Get alerts</p>
              <h3 className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                New roles by email — no noise.
              </h3>
              <p className="mt-2 text-slate-600 font-medium max-w-2xl">
                Set up an alert for your category focus. Alerts are tied to your account email.
              </p>
            </div>
            <div className="w-full lg:w-auto flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => router.push("/alerts")}
                className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700"
              >
                Get alerts →
              </button>
              <button
                type="button"
                onClick={() => router.push("/jobs")}
                className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-white border border-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-widest hover:border-indigo-200 hover:text-indigo-700"
              >
                Browse jobs
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 7) Compact employer section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="rounded-[2.75rem] border border-slate-200/60 bg-white p-8 sm:p-10 shadow-[0_18px_55px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500">For employers</p>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">Post a role that serious operators will trust.</h3>
              <p className="text-slate-600 font-medium mt-2 max-w-2xl">
                Salary-first listings. Clear scope. Reviewed before publish — best for Notion-heavy ops and systems work (but open to the broader niche).
              </p>
              <ul className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-slate-600 font-medium">
                <li className="flex items-center gap-2"><span className="text-emerald-600 font-black">✓</span> Salary required</li>
                <li className="flex items-center gap-2"><span className="text-emerald-600 font-black">✓</span> Remote constraints visible</li>
                <li className="flex items-center gap-2"><span className="text-emerald-600 font-black">✓</span> Reviewed before live</li>
              </ul>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <button
                type="button"
                onClick={() => router.push("/post-a-job")}
                className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-black"
              >
                Post a job
              </button>
              <button
                type="button"
                onClick={() => router.push("/pricing")}
                className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-white border border-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-widest hover:border-indigo-200 hover:text-indigo-700"
              >
                View pricing
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 8) Proof section (real data only) */}
      {showJobCounts && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-18">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "Live roles", value: String(jobs.length) },
              { label: "Teams with roles", value: String(companyCount) },
              { label: "Added (7d)", value: String(rolesLast7Days) },
            ].map((item) => (
              <div
                key={item.label}
                className="bg-white/85 backdrop-blur border border-slate-200/60 rounded-[2rem] p-6 text-center shadow-[0_16px_40px_rgba(15,23,42,0.06)]"
              >
                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{item.label}</div>
                <div className="text-3xl font-black text-slate-900 mt-3">{item.value}</div>
                {lastUpdatedText && (
                  <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Updated {lastUpdatedText}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

