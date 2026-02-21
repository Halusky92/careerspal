'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Testimonials from '../components/Testimonials';
import Newsletter from '../components/Newsletter';
import AIChatPanel from '../components/AIChatPanel';
import { Job } from '../types';
import { createJobSlug, createCompanySlug } from '../lib/jobs';
import CompanyLogo from '../components/CompanyLogo';
import JobMiniCard from "../components/JobMiniCard";
import JobRow from "../components/JobRow";
import { CATEGORIES } from "../constants";

const planWeight = { 'Elite Managed': 3, 'Featured Pro': 2, Standard: 1 };

export default function HomePage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobQuickQuery, setJobQuickQuery] = useState("");
  const [heroQuery, setHeroQuery] = useState("");
  const [showHeroSuggestions, setShowHeroSuggestions] = useState(false);

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

  const topJobs = useMemo(() => {
    return [...jobs].sort((a, b) => {
      const weightA = planWeight[a.planType || 'Standard'] || 1;
      const weightB = planWeight[b.planType || 'Standard'] || 1;
      if (weightA !== weightB) return weightB - weightA;
      return (b.timestamp ?? 0) - (a.timestamp ?? 0);
    });
  }, [jobs]);
  const latestJobs = useMemo(() => {
    return [...jobs].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
  }, [jobs]);
  const hasJobs = jobs.length > 0;
  const showJobCounts = !jobsLoading && hasJobs;
  const companyCount = useMemo(() => new Set(jobs.map((job) => job.company)).size, [jobs]);
  const matchTotal = useMemo(() => jobs.reduce((sum, job) => sum + (job.matches || 0), 0), [jobs]);
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

  const suggestions = useMemo(() => {
    if (!heroQuery.trim() || heroQuery.length < 1) return [];
    const q = heroQuery.toLowerCase();
    const titles = jobs.filter((j) => j.title.toLowerCase().includes(q)).map((j) => j.title);
    const companies = jobs.filter((j) => j.company.toLowerCase().includes(q)).map((j) => j.company);
    const tags = jobs.flatMap((j) => j.tags).filter((t) => t.toLowerCase().includes(q));
    const tools = jobs.flatMap((j) => j.tools || []).filter((t) => t.toLowerCase().includes(q));
    return Array.from(new Set([...titles, ...companies, ...tags, ...tools])).slice(0, 6);
  }, [heroQuery, jobs]);

  const goToJobs = (query?: string) => {
    const q = (query ?? "").trim();
    router.push(q ? `/jobs?query=${encodeURIComponent(q)}` : "/jobs");
  };

  const handleOpenCompany = (companyName: string) => {
    router.push(`/companies/${createCompanySlug({ name: companyName } as { name: string })}`);
  };

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

  return (
    <>
      <section className="relative overflow-hidden pt-10 sm:pt-14 pb-12 sm:pb-16 bg-[#F8F9FD]">
        <div className="absolute top-[-20%] left-[-15%] w-[70%] h-[70%] bg-indigo-300/18 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-violet-400/18 rounded-full blur-[140px]" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                Curated marketplace • Reviewed before publish
              </div>

              <h1 className="mt-5 text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-[1.05]">
                Find systems-first ops roles.
              </h1>
              <p className="mt-3 text-slate-600 font-medium max-w-2xl">
                Salary ranges required. Clean scope. Tool-stack mapped. Built for operators who want signal, not noise.
              </p>

              <div className="mt-6 rounded-[2.5rem] border border-slate-200/60 bg-white/85 backdrop-blur p-5 sm:p-6 shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Search the board
                </div>
                <div className="relative mt-3">
                  <input
                    value={heroQuery}
                    onChange={(e) => {
                      setHeroQuery(e.target.value);
                      setShowHeroSuggestions(true);
                    }}
                    onFocus={() => setShowHeroSuggestions(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setHeroQuery("");
                        setShowHeroSuggestions(false);
                      }
                      if (e.key === "Enter") {
                        setShowHeroSuggestions(false);
                        goToJobs(heroQuery);
                      }
                    }}
                    placeholder="Search: Ops, RevOps, Notion, Airtable, Automation…"
                    className="w-full rounded-2xl border border-slate-200/70 bg-white px-5 py-4 text-sm font-bold text-slate-800 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 pr-12"
                    autoComplete="off"
                    inputMode="search"
                  />
                  {heroQuery && (
                    <button
                      onClick={() => {
                        setHeroQuery("");
                        setShowHeroSuggestions(false);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-indigo-600"
                      aria-label="Clear search"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}

                  {showHeroSuggestions && suggestions.length > 0 && (
                    <div className="absolute left-0 right-0 mt-2 bg-white border border-indigo-50 rounded-2xl shadow-2xl overflow-hidden z-40">
                      {suggestions.map((s, idx) => (
                        <button
                          key={`${s}-${idx}`}
                          onClick={() => {
                            setHeroQuery(s);
                            setShowHeroSuggestions(false);
                            goToJobs(s);
                          }}
                          className="w-full text-left px-5 py-3 text-sm font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors border-b border-indigo-50/50 last:border-none"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {CATEGORIES.filter((c) => c !== "All Roles").slice(0, 8).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => router.push(`/jobs?category=${encodeURIComponent(cat)}`)}
                      className="px-3 py-1.5 rounded-full border border-slate-200 bg-white text-slate-600 text-[10px] font-black uppercase tracking-widest hover:border-indigo-200 hover:text-indigo-700"
                    >
                      {cat}
                    </button>
                  ))}
                  <button
                    onClick={() => router.push("/jobs")}
                    className="px-3 py-1.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:border-indigo-200 hover:text-indigo-700"
                  >
                    All roles →
                  </button>
                </div>

                <div className="mt-5 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => goToJobs(heroQuery)}
                    className="h-11 px-6 rounded-2xl bg-indigo-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-sm shadow-indigo-100"
                  >
                    Browse jobs
                  </button>
                  <button
                    onClick={() => router.push("/account")}
                    className="h-11 px-6 rounded-2xl border border-slate-200 bg-white text-[11px] font-black uppercase tracking-widest text-slate-700 hover:border-indigo-200 hover:text-indigo-700"
                  >
                    Create alert
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="rounded-[2.5rem] border border-slate-200/60 bg-white/85 backdrop-blur p-6 shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">For employers</div>
                <div className="mt-2 text-xl font-black text-slate-900">Post a role that converts.</div>
                <p className="mt-2 text-sm font-medium text-slate-600">
                  We review scope and verify the employer before it goes live. Response SLA is 2 days.
                </p>

                <div className="mt-5 grid grid-cols-1 gap-2">
                  {[
                    "Salary ranges required",
                    "Reviewed before publish",
                    "Tool-stack targeting",
                    "Refund window: 2 days",
                  ].map((line) => (
                    <div key={line} className="flex items-center gap-2 rounded-2xl border border-slate-200/60 bg-slate-50 px-4 py-3">
                      <span className="text-emerald-600 font-black">✓</span>
                      <span className="text-sm font-bold text-slate-700">{line}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex items-center gap-3">
                  <button
                    onClick={() => router.push("/post-a-job")}
                    className="h-11 px-6 rounded-2xl border border-slate-200 bg-white text-[11px] font-black uppercase tracking-widest text-slate-800 hover:border-indigo-200 hover:text-indigo-700"
                  >
                    Post a job
                  </button>
                  <button
                    onClick={() => router.push("/pricing")}
                    className="text-[11px] font-black uppercase tracking-widest text-indigo-700 hover:text-indigo-800"
                  >
                    View pricing →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 pb-10">
        <div className="bg-white/80 backdrop-blur border border-slate-200/60 rounded-[2.5rem] p-6 sm:p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Optimized for modern ops stacks</p>
            </div>
            <div className="relative w-full sm:w-[420px] overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-white/90 to-transparent pointer-events-none"></div>
              <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-white/90 to-transparent pointer-events-none"></div>
              <div className="flex items-center gap-6 animate-nav-loop pr-6">
                {[
                  { name: "Notion", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e9/Notion-logo.svg" },
                  { name: "Linear", logoUrl: "/logos/linear.png" },
                  { name: "Canva", logoUrl: "https://public.canva.site/logo/media/82983fc70ff088d1a1a2277f75f1c64d.svg" },
                  { name: "Ramp", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/4/4e/Ramp_Business_Corporation_Logo.svg" },
                  { name: "Webflow", logoUrl: "https://dhygzobemt712.cloudfront.net/Logo/Full_Logo_Blue_Black.svg" },
                  { name: "Airtable", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/4/4b/Airtable_Logo.svg" },
                ].map((item, idx) => (
                  <div key={`${item.name}-${idx}`} className="h-8 w-20 rounded-full bg-white/90 border border-slate-200/70 flex items-center justify-center">
                    <CompanyLogo
                      name={item.name}
                      logoUrl={item.logoUrl}
                      className="h-5 w-16 flex items-center justify-center"
                      imageClassName="h-4 w-auto object-contain grayscale opacity-80"
                      fallbackClassName="text-[9px]"
                    />
                  </div>
                ))}
                {[
                  { name: "Notion", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e9/Notion-logo.svg" },
                  { name: "Linear", logoUrl: "/logos/linear.png" },
                  { name: "Canva", logoUrl: "https://public.canva.site/logo/media/82983fc70ff088d1a1a2277f75f1c64d.svg" },
                  { name: "Ramp", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/4/4e/Ramp_Business_Corporation_Logo.svg" },
                  { name: "Webflow", logoUrl: "https://dhygzobemt712.cloudfront.net/Logo/Full_Logo_Blue_Black.svg" },
                  { name: "Airtable", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/4/4b/Airtable_Logo.svg" },
                ].map((item, idx) => (
                  <div key={`${item.name}-dup-${idx}`} className="h-8 w-20 rounded-full bg-white/90 border border-slate-200/70 flex items-center justify-center">
                    <CompanyLogo
                      name={item.name}
                      logoUrl={item.logoUrl}
                      className="h-5 w-16 flex items-center justify-center"
                      imageClassName="h-4 w-auto object-contain grayscale opacity-80"
                      fallbackClassName="text-[9px]"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        <div className="flex items-end justify-between gap-4 px-2">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Live jobs feed</div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">Latest roles</h2>
            <p className="text-sm text-slate-500 font-medium mt-1">
              {showJobCounts ? "Fresh postings from the last 30 days." : "New listings are reviewed daily."}
            </p>
          </div>
          <button
            onClick={() => router.push("/jobs")}
            className="hidden sm:inline-flex h-11 px-5 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-black"
          >
            Browse all
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {(jobsLoading ? Array.from({ length: 6 }) : latestJobs.slice(0, 10)).map((job: any, idx: number) =>
            jobsLoading ? (
              <div
                key={`skeleton-${idx}`}
                className="rounded-2xl border border-slate-200/60 bg-white px-4 py-4 shadow-sm"
              >
                <div className="h-4 w-48 bg-slate-100 rounded-lg mb-2" />
                <div className="h-3 w-72 max-w-full bg-slate-100 rounded-lg" />
              </div>
            ) : (
              <JobRow
                key={job.id}
                job={job}
                variant="home"
                showSave={false}
                showMenu={false}
                onOpenCompany={(companyName) => handleOpenCompany(companyName)}
                onSelect={() => router.push(`/jobs/${createJobSlug(job)}`)}
                onApply={() => handleApply(job)}
              />
            ),
          )}
        </div>

        <div className="pt-5">
          <button
            onClick={() => router.push('/jobs')}
            className="w-full py-4 rounded-[2rem] bg-white border border-slate-200/70 text-slate-700 font-black uppercase tracking-widest text-xs hover:border-indigo-200 hover:text-indigo-700 transition-all shadow-sm"
          >
            {hasJobs ? `View all ${jobs.length} roles →` : "Browse jobs →"}
          </button>
        </div>

        <div className="pt-8">
          <div className="flex items-center justify-between px-2 mb-3">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Just added</h4>
            <button
              onClick={() => router.push('/jobs')}
              className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800"
            >
              Explore
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {topJobs.slice(0, 3).map((job) => (
              <JobMiniCard key={`recent-${job.id}`} job={job} />
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        <div className="rounded-[2.5rem] border border-slate-200/60 bg-white/70 backdrop-blur p-6 sm:p-8 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Proof</p>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">High-signal marketplace.</h3>
              <p className="text-slate-500 font-medium mt-2 max-w-2xl">
                Filters are built for ops + systems roles. Listings are reviewed before they go live.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "Review speed", value: "Daily", note: "Reviewed before publish" },
              { label: "Response SLA", value: "2 days", note: "First response/update" },
              { label: "Salary ranges", value: "Required", note: "No range = rejected" },
            ].map((item) => (
              <div key={item.label} className="bg-white rounded-[1.8rem] border border-slate-200/60 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{item.label}</div>
                <div className="mt-2 text-2xl font-black text-slate-900">{item.value}</div>
                <div className="mt-2 text-sm font-medium text-slate-500">{item.note}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-[2rem] border border-slate-200/60 bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">
                  How verification works
                </div>
                <div className="mt-2 text-lg font-black text-slate-900">Review → Verify → Publish</div>
                <p className="mt-2 text-sm font-medium text-slate-600 max-w-2xl">
                  We confirm the employer identity, tighten scope, and enforce salary transparency. Low-signal listings don’t go live.
                </p>
              </div>
              <button
                onClick={() => router.push("/jobs")}
                className="hidden sm:inline-flex h-11 px-5 rounded-2xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-sm shadow-indigo-100"
              >
                Browse jobs
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { title: "Review", copy: "Enforce salary ranges + scope clarity." },
                { title: "Verify", copy: "Validate company domain + contact." },
                { title: "Publish", copy: "Rank by tool stack + fit signals." },
              ].map((item) => (
                <div key={item.title} className="rounded-[1.5rem] border border-slate-200/60 bg-slate-50/60 p-4">
                  <div className="text-[11px] font-black uppercase tracking-widest text-slate-800">{item.title}</div>
                  <div className="mt-2 text-sm font-medium text-slate-600">{item.copy}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="bg-white border border-slate-200/60 rounded-[2.5rem] p-6 sm:p-8 shadow-[0_20px_55px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Helper</p>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">Need help narrowing down?</h3>
              <p className="text-slate-500 font-medium mt-2 max-w-2xl">
                Ask the assistant for role ideas, keywords, or which filters to use. (It won’t replace the board — it helps you search it.)
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7">
              <AIChatPanel jobs={jobs} />
            </div>
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white rounded-2xl shadow-sm border border-amber-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-white">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Quick filter</div>
                  <div className="text-sm font-black text-slate-900 mt-1">Jump to roles on the board</div>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      value={jobQuickQuery}
                      onChange={(e) => setJobQuickQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        goToJobs(jobQuickQuery);
                      }}
                      placeholder="Search roles (e.g. Ops, Notion, Automation)"
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300"
                    />
                    <button
                      onClick={() => goToJobs(jobQuickQuery)}
                      className="h-11 px-5 rounded-2xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-sm shadow-indigo-100"
                    >
                      View
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {["Operations", "Automation", "Notion", "Remote"].map((chip) => (
                      <button
                        key={chip}
                        onClick={() => goToJobs(chip)}
                        className="px-3 py-1.5 rounded-full border border-amber-200 bg-amber-50 text-amber-800 text-[10px] font-black uppercase tracking-widest hover:bg-amber-100"
                      >
                        {chip}
                      </button>
                    ))}
                    <button
                      onClick={() => goToJobs("")}
                      className="px-3 py-1.5 rounded-full border border-slate-200 bg-white text-slate-500 text-[10px] font-black uppercase tracking-widest hover:border-indigo-200 hover:text-indigo-600"
                    >
                      All jobs →
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/60 bg-slate-50/60 p-5">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Live signal</div>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  {(showJobCounts
                    ? [
                        { label: "Live roles", value: String(jobs.length) },
                        { label: "Teams", value: String(companyCount) },
                        { label: "Added (7d)", value: String(rolesLast7Days) },
                      ]
                    : [
                        { label: "Review", value: "Daily" },
                        { label: "SLA", value: "2 days" },
                        { label: "Quality", value: "Verified" },
                      ]
                  ).map((item) => (
                    <div key={item.label} className="rounded-2xl border border-slate-200/60 bg-white px-4 py-3 text-center">
                      <div className="text-lg font-black text-slate-900">{item.value}</div>
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">{item.label}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {lastUpdatedText ? `Updated ${lastUpdatedText}` : "Updated daily"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-14">
        <div className="bg-white border border-slate-200/60 rounded-[2.5rem] p-6 sm:p-8 shadow-[0_20px_55px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">How it works</p>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">Clear flow for talent and employers.</h2>
            </div>
            <p className="text-slate-500 font-medium max-w-2xl">
              We review every submission, enforce response SLAs, and protect candidates from ghosting.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-[2rem] border border-slate-200/60 bg-slate-50/70 p-6">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Talent</h3>
              <ol className="mt-4 space-y-3 text-sm text-slate-600 font-medium">
                <li><span className="text-slate-900 font-black">1. Apply</span> — request access and share your role focus.</li>
                <li><span className="text-slate-900 font-black">2. Review</span> — we verify fit and confirm your stack.</li>
                <li><span className="text-slate-900 font-black">3. Match</span> — get early access roles and direct apply links.</li>
              </ol>
            </div>
            <div className="rounded-[2rem] border border-slate-200/60 bg-white p-6">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Employers</h3>
              <ol className="mt-4 space-y-3 text-sm text-slate-600 font-medium">
                <li><span className="text-slate-900 font-black">1. Submit</span> — post a role with salary range and scope.</li>
                <li><span className="text-slate-900 font-black">2. Verify</span> — we check legitimacy and set response SLA.</li>
                <li><span className="text-slate-900 font-black">3. Publish</span> — approved roles go live and are promoted.</li>
              </ol>
              <p className="mt-4 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                SLA = response within 2 days • No-ghosting enforcement
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="bg-white border border-slate-200/60 shadow-[0_25px_70px_rgba(15,23,42,0.06)] rounded-[3rem] p-10 md:p-14">
          <div className="text-center mb-10">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-indigo-400">Why CareersPal</p>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mt-2">Built for serious operators.</h2>
            <p className="text-sm md:text-base text-slate-500 font-medium mt-3 max-w-2xl mx-auto">
              A premium board for roles with clear scope, honest salary ranges, and teams that value operations excellence.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: 'Curated roles only',
                copy: 'Every listing is reviewed for clarity, salary transparency, and relevance.',
              },
              {
                title: 'Verified employers',
                copy: 'No noise, no spam. Work with teams that value operations excellence.',
              },
              {
                title: 'Designed for remote',
                copy: 'Find async-first teams with clear expectations and strong systems.',
              },
            ].map((item) => (
              <div key={item.title} className="space-y-3 rounded-[2rem] border border-slate-100 bg-slate-50/60 p-6 text-left shadow-sm">
                <h3 className="text-lg font-black text-slate-900">{item.title}</h3>
                <p className="text-sm text-slate-500 font-medium">{item.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: "Signal Density", value: "High", note: "No spam listings" },
            { label: "Salary Coverage", value: "100%", note: "Ranges required" },
            { label: "Response SLA", value: "2 days", note: "Verified hiring" },
          ].map((item) => (
            <div key={item.label} className="bg-white/80 backdrop-blur border border-slate-200/60 rounded-[2rem] p-6 text-center shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{item.label}</div>
              <div className="text-3xl font-black text-slate-900 mt-3">{item.value}</div>
              <p className="text-slate-500 font-medium mt-2">{item.note}</p>
            </div>
          ))}
        </div>
      </section>

      <Testimonials />
      <Newsletter />
    </>
  );
}
