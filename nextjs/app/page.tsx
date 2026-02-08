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

const planWeight = { 'Elite Managed': 3, 'Featured Pro': 2, Standard: 1 };

const isNewListing = (postedAt: string) => {
  const lower = postedAt.toLowerCase();
  return lower.includes('just now') || lower.includes('hour') || lower.includes('min');
};

export default function HomePage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
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
  const companyCount = useMemo(() => new Set(jobs.map((job) => job.company)).size, [jobs]);
  const matchTotal = useMemo(() => jobs.reduce((sum, job) => sum + (job.matches || 0), 0), [jobs]);

  const handleSearch = (query: string) => {
    router.push(`/jobs?query=${encodeURIComponent(query)}`);
  };

  const handleOpenJob = (job: Job) => {
    router.push(`/jobs/${createJobSlug(job)}`);
  };
  const handleToggleJob = (job: Job) => {
    if (job.status === 'private' || job.status === 'invite_only') return;
    setExpandedJobId((prev) => (prev === job.id ? null : job.id));
  };

  const handleOpenCompany = (companyName: string) => {
    router.push(`/companies/${createCompanySlug({ name: companyName } as { name: string })}`);
  };

  return (
    <>
      <Hero
        onBrowse={() => router.push('/jobs')}
        onJoinPool={() => router.push('/hire-talent')}
        onSearch={handleSearch}
        jobs={jobs}
      />

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 pb-8">
        <div className="bg-indigo-600 text-white rounded-[2rem] px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl shadow-indigo-200">
          <span className="text-[10px] font-black uppercase tracking-widest">Invite-only roles just opened</span>
          <button
            onClick={() => router.push('/jobs')}
            className="px-4 py-2 rounded-full bg-white text-indigo-600 text-[10px] font-black uppercase tracking-widest"
          >
            Explore now
          </button>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 pb-10">
        <div className="bg-white/80 backdrop-blur border border-slate-200/60 rounded-[2.5rem] p-6 sm:p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Trusted by systems-first teams</p>
            </div>
            <div className="relative w-full sm:w-[420px] overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-white/90 to-transparent pointer-events-none"></div>
              <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-white/90 to-transparent pointer-events-none"></div>
              <div className="flex items-center gap-6 animate-nav-loop pr-6">
                {[
                  { name: "Notion", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e9/Notion-logo.svg", glow: "shadow-[0_0_18px_rgba(0,0,0,0.15)]" },
                  { name: "Linear", logoUrl: "/logos/linear.png", glow: "shadow-[0_0_18px_rgba(99,102,241,0.25)]" },
                  { name: "Canva", logoUrl: "https://public.canva.site/logo/media/82983fc70ff088d1a1a2277f75f1c64d.svg", glow: "shadow-[0_0_18px_rgba(0,180,216,0.25)]" },
                  { name: "Ramp", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/4/4e/Ramp_Business_Corporation_Logo.svg", glow: "shadow-[0_0_18px_rgba(16,185,129,0.25)]" },
                  { name: "Webflow", logoUrl: "https://dhygzobemt712.cloudfront.net/Logo/Full_Logo_Blue_Black.svg", glow: "shadow-[0_0_18px_rgba(59,130,246,0.25)]" },
                  { name: "Airtable", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/4/4b/Airtable_Logo.svg", glow: "shadow-[0_0_18px_rgba(250,204,21,0.25)]" },
                ].map((item, idx) => (
                  <div key={`${item.name}-${idx}`} className={`h-9 w-24 rounded-full bg-white/90 border border-slate-200/70 flex items-center justify-center ${item.glow}`}>
                    <CompanyLogo
                      name={item.name}
                      logoUrl={item.logoUrl}
                      className="h-5 w-16 flex items-center justify-center"
                      imageClassName="h-4 w-auto object-contain"
                      fallbackClassName="text-[9px]"
                    />
                  </div>
                ))}
                {[
                  { name: "Notion", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e9/Notion-logo.svg", glow: "shadow-[0_0_18px_rgba(0,0,0,0.15)]" },
                  { name: "Linear", logoUrl: "/logos/linear.png", glow: "shadow-[0_0_18px_rgba(99,102,241,0.25)]" },
                  { name: "Canva", logoUrl: "https://public.canva.site/logo/media/82983fc70ff088d1a1a2277f75f1c64d.svg", glow: "shadow-[0_0_18px_rgba(0,180,216,0.25)]" },
                  { name: "Ramp", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/4/4e/Ramp_Business_Corporation_Logo.svg", glow: "shadow-[0_0_18px_rgba(16,185,129,0.25)]" },
                  { name: "Webflow", logoUrl: "https://dhygzobemt712.cloudfront.net/Logo/Full_Logo_Blue_Black.svg", glow: "shadow-[0_0_18px_rgba(59,130,246,0.25)]" },
                  { name: "Airtable", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/4/4b/Airtable_Logo.svg", glow: "shadow-[0_0_18px_rgba(250,204,21,0.25)]" },
                ].map((item, idx) => (
                  <div key={`${item.name}-dup-${idx}`} className={`h-9 w-24 rounded-full bg-white/90 border border-slate-200/70 flex items-center justify-center ${item.glow}`}>
                    <CompanyLogo
                      name={item.name}
                      logoUrl={item.logoUrl}
                      className="h-5 w-16 flex items-center justify-center"
                      imageClassName="h-4 w-auto object-contain"
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
        <div className="rounded-[2.5rem] border border-slate-200/60 bg-white/70 backdrop-blur p-6 sm:p-8 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-8">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Quality pipeline</p>
              <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">Every role passes a strict review.</h3>
              <p className="text-slate-500 font-medium mt-2 max-w-2xl">
                We verify the employer, tighten the scope, and rank roles by fit so you only see signal.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-700">
              Verified listings only
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[
              {
                title: "Review",
                copy: "We rewrite vague postings, enforce salary ranges, and clarify scope.",
                tags: ["Clarity", "Salary range", "Scope"],
              },
              {
                title: "Verify",
                copy: "Employers pass a trust check and commit to response SLAs.",
                tags: ["Trust check", "SLA", "Quality"],
              },
              {
                title: "Match",
                copy: "Roles are highlighted by tool stack, seniority, and fit.",
                tags: ["Stack fit", "Level", "Relevance"],
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-white rounded-[2rem] border border-slate-200/60 p-6 shadow-[0_12px_30px_rgba(15,23,42,0.06)]"
              >
                <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center font-black">
                  ✦
                </div>
                <h3 className="text-xl font-black text-slate-900 mt-4">{item.title}</h3>
                <p className="text-slate-500 font-medium mt-2">{item.copy}</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 border border-slate-200/60"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
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
                We keep the board tight so each click feels worth it.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Live roles", value: jobs.length },
                { label: "Teams", value: companyCount },
                { label: "Matches", value: matchTotal || 0 },
              ].map((item) => (
                <div key={item.label} className="bg-white/10 border border-white/10 rounded-2xl px-4 py-4 text-center">
                  <div className="text-2xl font-black">{item.value}</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-indigo-100 mt-1">{item.label}</div>
                </div>
              ))}
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
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">Top picks from the Elite Board</h3>
                <p className="text-sm text-slate-500 font-medium mt-1">Hand-reviewed, ranked by impact and freshness.</p>
              </div>
              <span className="inline-flex items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-600">
                Top 5
              </span>
            </div>

            {topJobs.slice(0, 5).map((job) => {
              const isElite = job.planType === 'Elite Managed';
              const isPro = job.planType === 'Featured Pro';
              const isNew = isNewListing(job.postedAt);
              const hasApplyUrl = Boolean(job.applyUrl && job.applyUrl.trim() && job.applyUrl !== '#');

              return (
                <div
                  key={job.id}
                  onClick={() => handleToggleJob(job)}
                  className={`
                    p-6 rounded-[2.5rem] shadow-lg transition-all cursor-pointer flex flex-col items-stretch justify-between group relative gap-4
                    ${isElite ? 'bg-yellow-50 text-slate-900 border-2 border-yellow-200 shadow-yellow-100/40' : 
                      isPro ? 'bg-white border-2 border-indigo-100 ring-2 ring-indigo-50' : 
                      'bg-white border border-transparent hover:border-indigo-100'}
                  `}
                >
                  {(isElite || isPro) && (
                    <div
                      className={`absolute -top-3 left-6 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm
                        ${isElite ? 'bg-yellow-200 text-yellow-900' : 'bg-indigo-600 text-white'}`}
                    >
                      {isElite ? 'Elite' : 'Featured'}
                    </div>
                  )}

                  {isNew && (
                    <div className="absolute -top-3 right-8 animate-pulse">
                      <span className="bg-red-500 text-white text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-red-200 shadow-lg border-2 border-white">
                        New Drop
                      </span>
                    </div>
                  )}

                  <div className="flex items-center space-x-4 sm:space-x-6 w-full">
                    <div
                      className={`w-14 h-14 rounded-xl flex items-center justify-center p-1 relative
                        ${isElite ? 'bg-yellow-100 border border-yellow-200' : 'bg-slate-50 border'}
                      `}
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
                    <div>
                      <h4
                        className={`font-black transition-colors ${
                          isElite ? 'text-slate-900 group-hover:text-yellow-700' : 'text-slate-900 group-hover:text-indigo-600'
                        }`}
                      >
                        {job.title}
                      </h4>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenCompany(job.company);
                          }}
                          className={`font-bold text-[10px] uppercase tracking-wider hover:underline ${
                            isElite ? 'text-yellow-700' : 'text-indigo-600'
                          }`}
                        >
                          {job.company}
                        </button>
                        <span className={`text-[10px] ${isElite ? 'text-yellow-300' : 'text-slate-300'}`}>•</span>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isElite ? 'text-yellow-700' : 'text-slate-400'}`}>
                          {job.location}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-start sm:items-end sm:text-right w-full">
                    <span className={`font-black text-lg tracking-tighter whitespace-nowrap ${isElite ? 'text-yellow-900' : 'text-slate-900'}`}>
                      {job.salary}
                    </span>
                  </div>
                  {expandedJobId === job.id && (
                    <div className="w-full bg-white/90 border border-slate-200/70 rounded-[2rem] p-5 sm:p-6 text-left">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Role overview</p>
                        <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">
                          {job.description || "Description coming soon."}
                        </p>
                      </div>
                      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] font-bold text-slate-600">
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <span className="text-[9px] uppercase tracking-widest text-slate-400">Company</span>
                          <div className="mt-1">{job.company || "N/A"}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <span className="text-[9px] uppercase tracking-widest text-slate-400">Location</span>
                          <div className="mt-1">{job.location || "N/A"}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <span className="text-[9px] uppercase tracking-widest text-slate-400">Type</span>
                          <div className="mt-1">{job.type || "N/A"}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <span className="text-[9px] uppercase tracking-widest text-slate-400">Posted</span>
                          <div className="mt-1">{job.postedAt}</div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!hasApplyUrl) return;
                          window.open(job.applyUrl, '_blank', 'noopener,noreferrer');
                        }}
                        disabled={!hasApplyUrl}
                        className={`mt-4 inline-flex items-center justify-center rounded-full px-4 py-2 text-[9px] font-black uppercase tracking-widest transition-all w-full sm:w-auto ${
                          hasApplyUrl
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        {hasApplyUrl ? 'Quick apply' : 'Apply soon'}
                      </button>
                      {/* Full details CTA temporarily hidden; keep placement for later */}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="pt-4">
              <button
                onClick={() => router.push('/jobs')}
                className="w-full py-4 rounded-[2rem] bg-white border-2 border-slate-100 text-slate-600 font-black uppercase tracking-widest text-xs hover:border-indigo-600 hover:text-indigo-600 transition-all shadow-sm"
              >
                View All {jobs.length} Open Positions →
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
                  (() => {
                    const hasApplyUrl = Boolean(job.applyUrl && job.applyUrl.trim() && job.applyUrl !== '#');
                    return (
                      <div
                    key={`recent-${job.id}`}
                    onClick={() => handleToggleJob(job)}
                    className="bg-white/80 backdrop-blur border border-slate-200/60 rounded-2xl p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)] hover:shadow-xl transition-all cursor-pointer"
                  >
                    <div className="text-xs font-black text-slate-900 truncate">{job.title}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 truncate">
                      {job.company}
                    </div>
                    {expandedJobId === job.id && (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-[11px] font-bold text-slate-600 space-y-2">
                        <p className="text-[9px] uppercase tracking-widest text-slate-400">Role overview</p>
                        <p className="text-slate-700 text-xs whitespace-pre-wrap">
                          {job.description || "Description coming soon."}
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!hasApplyUrl) return;
                            window.open(job.applyUrl, '_blank', 'noopener,noreferrer');
                          }}
                          disabled={!hasApplyUrl}
                          className={`mt-2 inline-flex items-center justify-center rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all w-full ${
                            hasApplyUrl
                              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          {hasApplyUrl ? 'Quick apply' : 'Apply soon'}
                        </button>
                        {/* Full details CTA temporarily hidden; keep placement for later */}
                      </div>
                    )}
                      </div>
                    );
                  })()
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-4">
            <AIChatPanel jobs={jobs} />
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
            { label: "Response SLA", value: "7 days", note: "Verified hiring" },
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
