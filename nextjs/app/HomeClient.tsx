'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Hero from '../components/Hero';
import Testimonials from '../components/Testimonials';
import Newsletter from '../components/Newsletter';
import AIChatPanel from '../components/AIChatPanel';
import { Job } from '../types';
import { createJobSlug, createCompanySlug } from '../lib/jobs';
import CompanyLogo from '../components/CompanyLogo';
import JobMiniCard from "../components/JobMiniCard";
import JobRow from "../components/JobRow";

const planWeight = { 'Elite Managed': 3, 'Featured Pro': 2, Standard: 1 };

export default function HomeClient({ initialJobs }: { initialJobs: Job[] }) {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>(() => initialJobs || []);
  const [jobsLoading, setJobsLoading] = useState(() => (initialJobs?.length ? false : true));
  const [jobQuickQuery, setJobQuickQuery] = useState("");
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
      const weightA = planWeight[a.planType || 'Standard'] || 1;
      const weightB = planWeight[b.planType || 'Standard'] || 1;
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

  const handleSearch = (query: string) => {
    router.push(`/jobs?query=${encodeURIComponent(query)}`);
  };

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
      <Hero
        onBrowse={() => router.push('/jobs')}
        onJoinPool={() => router.push('/hire-talent')}
        onSearch={handleSearch}
        jobs={jobs}
      />

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 pb-10">
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

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-10 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-2 mb-3">
              <div>
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Featured & latest roles</p>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
                  {hasJobs ? "Top picks from the Elite Board" : "Curated roles, verified teams"}
                </h3>
                <p className="text-sm text-slate-500 font-medium mt-1">
                  {hasJobs
                    ? "Hand-reviewed, ranked by impact and freshness."
                    : "Browse the board or post a role — every listing is reviewed before it goes live."}
                </p>
              </div>
              {hasJobs && (
                <span className="inline-flex items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-600">
                  Top 5
                </span>
              )}
            </div>

            {jobsLoading && (
              <div className="rounded-[2.5rem] border border-slate-200/70 bg-white p-8 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
                <div className="h-6 w-56 bg-slate-100 rounded-xl mx-auto mb-3"></div>
                <div className="h-4 w-80 max-w-full bg-slate-100 rounded-xl mx-auto mb-6"></div>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <div className="h-10 w-40 bg-slate-100 rounded-2xl"></div>
                  <div className="h-10 w-40 bg-slate-100 rounded-2xl"></div>
                </div>
              </div>
            )}

            {!jobsLoading && !hasJobs && (
              <div className="rounded-[2.5rem] border border-slate-200/70 bg-white p-8 text-center shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
                <div className="text-2xl font-black text-slate-900">New roles are reviewed daily.</div>
                <p className="text-sm text-slate-500 font-medium mt-2">
                  Post a role now and we’ll review it before it goes live.
                </p>
                <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => router.push('/post-a-job')}
                    className="px-5 py-3 rounded-2xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest hover:bg-indigo-700"
                  >
                    Post a role
                  </button>
                  <button
                    onClick={() => router.push('/jobs')}
                    className="px-5 py-3 rounded-2xl bg-white border border-slate-200 text-slate-600 text-xs font-black uppercase tracking-widest hover:border-indigo-600 hover:text-indigo-600"
                  >
                    Browse jobs
                  </button>
                </div>
              </div>
            )}

            {hasJobs && (
              <div className="space-y-4">
                {topJobs.slice(0, 5).map((job) => (
                  <JobRow
                    key={job.id}
                    job={job}
                    variant="home"
                    expanded={!isSmUp && expandedJobId === job.id}
                    showSave={false}
                    showMenu={false}
                    onOpenCompany={(companyName) => handleOpenCompany(companyName)}
                    onSelect={() => {
                      if (isSmUp) {
                        router.push(`/jobs/${createJobSlug(job)}`);
                        return;
                      }
                      setExpandedJobId((prev) => (prev === job.id ? null : job.id));
                    }}
                    onApply={() => handleApply(job)}
                  />
                ))}
              </div>
            )}

            <div className="pt-4">
              <button
                onClick={() => router.push('/jobs')}
                className="w-full py-4 rounded-[2rem] bg-white border-2 border-slate-100 text-slate-600 font-black uppercase tracking-widest text-xs hover:border-indigo-600 hover:text-indigo-600 transition-all shadow-sm"
              >
                {hasJobs ? `View All ${jobs.length} Open Positions →` : "Browse jobs →"}
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
          </div>

          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-24 space-y-4">
              <AIChatPanel jobs={jobs} />
              <div className="bg-white rounded-2xl shadow-xl border border-amber-100 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-white">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Quick filter</div>
                  <div className="text-sm font-black text-slate-900 mt-1">Jump to roles on the board</div>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      value={jobQuickQuery}
                      onChange={(e) => setJobQuickQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        goToJobs(jobQuickQuery);
                      }}
                      placeholder="Search roles (e.g. Ops, Notion, Automation)"
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-4 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                    <button
                      onClick={() => goToJobs(jobQuickQuery)}
                      className="px-4 py-2 rounded-full bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700"
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
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        <div className="rounded-[2.5rem] border border-slate-200/60 bg-white/70 backdrop-blur p-6 sm:p-8 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Quality pipeline</p>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">Every role passes a strict review.</h3>
              <p className="text-slate-500 font-medium mt-2 max-w-2xl">
                We verify the employer, tighten scope, and rank roles by fit so you only see signal.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-700">
              Verified listings only
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                title: "Review",
                copy: "We rewrite vague postings, enforce salary ranges, and clarify scope.",
              },
              {
                title: "Verify",
                copy: "We validate employer identity (domain + contact) and check for red flags before publishing.",
              },
              {
                title: "Match",
                copy: "Roles are highlighted by tool stack, seniority, and fit.",
              },
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

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="bg-slate-900 text-white rounded-[3rem] p-8 sm:p-12 shadow-2xl">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-200">Live signal</p>
              <h3 className="text-3xl sm:text-4xl font-black mt-3">High-quality roles, no noise.</h3>
              <p className="text-slate-300 font-medium mt-2 max-w-2xl">
                {showJobCounts
                  ? `Real roles from the last 30 days, reviewed before publish${lastUpdatedText ? ` • Updated ${lastUpdatedText}` : ""}.`
                  : "New listings are reviewed daily. Check back soon."}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {(showJobCounts
                ? [
                    { label: "Live roles", value: String(jobs.length) },
                    { label: "Teams", value: String(companyCount) },
                    { label: "Added (7d)", value: String(rolesLast7Days) },
                  ]
                : [
                    { label: "Review speed", value: "Daily" },
                    { label: "Response SLA", value: "2 days" },
                    { label: "Quality", value: "Verified" },
                  ]
              ).map((item) => (
                <div key={item.label} className="bg-white/10 border border-white/10 rounded-2xl px-4 py-4 text-center">
                  <div className="text-2xl font-black">{item.value}</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-indigo-100 mt-1">{item.label}</div>
                </div>
              ))}
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

