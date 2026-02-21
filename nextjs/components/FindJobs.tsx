"use client";


import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Job, UserSession } from '../types';
import { createCompanySlug, createJobSlug } from '../lib/jobs';
import { CATEGORIES } from '../constants';
import { useSupabaseAuth } from "./Providers";
import { authFetch } from "../lib/authFetch";
import JobRow from "./JobRow";
import JobDetailPanel from "./JobDetailPanel";

interface FindJobsProps {
  jobs: Job[];
  onSelectJob?: (job: Job) => void;
  onSelectCompany?: (companyName: string) => void;
  initialQuery?: string;
  initialLocationQuery?: string;
  user?: UserSession | null;
  onToggleBookmark: (jobId: string) => void;
  onQueryUpdate?: (query: string, locationQuery: string) => void;
}

const JOBS_PER_PAGE = 7;

const FindJobs: React.FC<FindJobsProps> = ({
  jobs,
  onSelectJob,
  onSelectCompany,
  initialQuery = '',
  initialLocationQuery = '',
  user,
  onToggleBookmark,
  onQueryUpdate,
}) => {
  const router = useRouter();
  const { accessToken } = useSupabaseAuth();
  const [query, setQuery] = useState(initialQuery);
  const [locationQuery, setLocationQuery] = useState(initialLocationQuery);
  const [category, setCategory] = useState('All Roles');
  const [system, setSystem] = useState('All Systems');
  const [workMode, setWorkMode] = useState<'All' | 'Remote' | 'Hybrid' | 'Onsite'>('All');
  const [employmentType, setEmploymentType] = useState<'All' | Job['type']>('All');
  const [sortBy, setSortBy] = useState<'newest' | 'salary' | 'match'>('newest');
  const [minSalary, setMinSalary] = useState(0);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showTitleSuggestions, setShowTitleSuggestions] = useState(false);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const titleRef = useRef<HTMLDivElement>(null);
  const locationRef = useRef<HTMLDivElement>(null);
  const filterScrollRef = useRef<HTMLDivElement>(null);
  const [showFilterTopShadow, setShowFilterTopShadow] = useState(false);
  const [showFilterBottomShadow, setShowFilterBottomShadow] = useState(false);
  
  // Pagination State
  const [visibleCount, setVisibleCount] = useState(JOBS_PER_PAGE);

  const systems = ['All Systems', 'Notion', 'Zapier', 'Make.com', 'Airtable'];
  const workModes: Array<'All' | 'Remote' | 'Hybrid' | 'Onsite'> = ['All', 'Remote', 'Hybrid', 'Onsite'];
  const employmentTypes: Array<'All' | Job['type']> = ['All', 'Full-time', 'Contract', 'Part-time'];
  const salaryFloors = [
    { label: 'Any', value: 0 },
    { label: '$60k+', value: 60000 },
    { label: '$80k+', value: 80000 },
    { label: '$100k+', value: 100000 },
    { label: '$120k+', value: 120000 },
  ];

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    setLocationQuery(initialLocationQuery);
  }, [initialLocationQuery]);

  useEffect(() => {
    if (!onQueryUpdate) return;
    const timer = window.setTimeout(() => onQueryUpdate(query, locationQuery), 300);
    return () => window.clearTimeout(timer);
  }, [query, locationQuery, onQueryUpdate]);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(JOBS_PER_PAGE);
  }, [query, locationQuery, category, system, sortBy, workMode, employmentType, minSalary]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    try {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    } catch {
      // Safari fallback
      mq.addListener(update);
      return () => mq.removeListener(update);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (titleRef.current && !titleRef.current.contains(event.target as Node)) {
        setShowTitleSuggestions(false);
      }
      if (locationRef.current && !locationRef.current.contains(event.target as Node)) {
        setShowLocationSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const target = filterScrollRef.current;
    if (!target) return;

    const updateShadows = () => {
      const { scrollTop, clientHeight, scrollHeight } = target;
      setShowFilterTopShadow(scrollTop > 4);
      setShowFilterBottomShadow(scrollTop + clientHeight < scrollHeight - 4);
    };

    updateShadows();
    target.addEventListener('scroll', updateShadows);
    window.addEventListener('resize', updateShadows);

    return () => {
      target.removeEventListener('scroll', updateShadows);
      window.removeEventListener('resize', updateShadows);
    };
  }, []);

  const parseSalaryRange = (salary: string) => {
    const normalized = salary.toLowerCase().replace(/,/g, '');
    const isHourly =
      normalized.includes('/hr') || normalized.includes('per hour') || normalized.includes('hour');
    const matches = [...normalized.matchAll(/\$?\s?(\d+(?:\.\d+)?)(k)?/g)];
    const values = matches
      .map((match) => {
        const raw = parseFloat(match[1]);
        if (Number.isNaN(raw)) return null;
        const isThousands = Boolean(match[2]) || normalized.includes('k');
        return isThousands ? raw * 1000 : raw;
      })
      .filter((value): value is number => value !== null);
    if (values.length === 0) return { min: 0, max: 0 };
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (isHourly) {
      min *= 2080;
      max *= 2080;
    }
    return { min, max };
  };

  const getSalaryValue = (salary: string) => parseSalaryRange(salary).max;
  const formatSalaryFloor = (value: number) => {
    if (!value) return 'Any';
    return `$${Math.round(value / 1000)}k+`;
  };
  const getWorkMode = (job: Job) => {
    const policy = job.remotePolicy?.toLowerCase() || '';
    if (policy.includes('hybrid')) return 'Hybrid';
    if (policy.includes('remote')) return 'Remote';
    return 'Onsite';
  };

  // Helper to determine salary competitiveness
  const getSalaryLevel = (salary: string) => {
    const val = getSalaryValue(salary);
    if (val > 140000) return { label: 'Top 5%', color: 'bg-emerald-500', width: '95%' };
    if (val > 110000) return { label: 'High', color: 'bg-indigo-500', width: '75%' };
    if (val > 80000) return { label: 'Market', color: 'bg-blue-400', width: '50%' };
    return { label: 'Entry', color: 'bg-slate-300', width: '30%' };
  };

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { 'All Roles': jobs.length };
    CATEGORIES.forEach(cat => {
      if (cat !== 'All Roles') {
        counts[cat] = jobs.filter(j => j.category === cat).length;
      }
    });
    return counts;
  }, [jobs]);

  const typeCounts = useMemo(() => {
    return jobs.reduce<Record<string, number>>((acc, job) => {
      acc[job.type] = (acc[job.type] || 0) + 1;
      return acc;
    }, {});
  }, [jobs]);

  const savedIds = useMemo(() => new Set(user?.savedJobIds || []), [user?.savedJobIds]);
  const savedCount = savedIds.size;
  const canUseSaved = user?.role !== "employer";

  const filteredAndSorted = useMemo(() => {
    let result = jobs.filter(j => {
      const matchesQuery = j.title.toLowerCase().includes(query.toLowerCase()) || 
                          j.company.toLowerCase().includes(query.toLowerCase()) ||
                          j.tags.some(t => t.toLowerCase().includes(query.toLowerCase()));
      const matchesLocation =
        !locationQuery.trim() || j.location.toLowerCase().includes(locationQuery.toLowerCase());
      const matchesCat = category === 'All Roles' || j.category === category;
      const matchesSystem = system === 'All Systems' || j.tags.some(t => t.includes(system));
      const matchesWorkMode = workMode === 'All' || getWorkMode(j) === workMode;
      const matchesEmployment = employmentType === 'All' || j.type === employmentType;
      const salaryRange = parseSalaryRange(j.salary);
      const matchesSalary = minSalary === 0 || salaryRange.max >= minSalary;
      const matchesSaved = !showSavedOnly || savedIds.has(j.id);
      return matchesQuery && matchesLocation && matchesCat && matchesSystem && matchesWorkMode && matchesEmployment && matchesSalary && matchesSaved;
    });

    // Sort order: Elite -> Featured -> Standard, then by user sort
    result = result.sort((a, b) => {
      const planWeight = { 'Elite Managed': 3, 'Featured Pro': 2, 'Standard': 1 };
      const weightA = planWeight[a.planType || 'Standard'] || 1;
      const weightB = planWeight[b.planType || 'Standard'] || 1;
      
      if (weightA !== weightB) return weightB - weightA;

      if (sortBy === 'salary') {
        return getSalaryValue(b.salary) - getSalaryValue(a.salary);
      }

      if (sortBy === 'match') {
        return (b.matchScore ?? 0) - (a.matchScore ?? 0);
      }
      
      // Secondary Sort: Date (Newest First) if weights are equal and not sorting by salary
      const timeA = a.timestamp ?? 0;
      const timeB = b.timestamp ?? 0;
      return timeB - timeA;
    });
    
    return result;
  }, [jobs, query, locationQuery, category, system, sortBy, workMode, employmentType, minSalary]);

  const suggestions = useMemo(() => {
    if (!query.trim() || query.length < 1) return [];
    const lowQuery = query.toLowerCase();
    
    const titles = jobs.filter(j => j.title.toLowerCase().includes(lowQuery)).map(j => j.title);
    const companies = jobs.filter(j => j.company.toLowerCase().includes(lowQuery)).map(j => j.company);
    const tags = jobs.flatMap(j => j.tags).filter(t => t.toLowerCase().includes(lowQuery));
    
    return Array.from(new Set([...titles, ...companies, ...tags])).slice(0, 5);
  }, [query, jobs]);

  const locationSuggestions = useMemo(() => {
    if (!locationQuery.trim() || locationQuery.length < 1) return [];
    const lowQuery = locationQuery.toLowerCase();
    const locations = jobs
      .map((j) => j.location)
      .filter((loc) => loc.toLowerCase().includes(lowQuery));
    return Array.from(new Set(locations)).slice(0, 5);
  }, [locationQuery, jobs]);

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + JOBS_PER_PAGE);
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

  const handleSaveSearch = async () => {
    if (!query.trim() && !locationQuery.trim()) return;
    setIsSaving(true);
    setSavedNotice('');
    const fullQuery = locationQuery.trim() ? `${query} @ ${locationQuery}` : query;
    try {
      if (!accessToken) {
        setSavedNotice('Sign in to save alerts');
        return;
      }
      const response = await authFetch(
        '/api/alerts',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: fullQuery }),
        },
        accessToken,
      );
      const payload = (await response.json()) as { existing?: boolean };
      if (response.ok) {
        setSavedNotice(payload.existing ? 'Alert already saved' : 'Alert saved');
      } else {
        setSavedNotice('Sign in to save alerts');
      }
    } catch {
      setSavedNotice('Unable to save alert');
    } finally {
      setIsSaving(false);
    }
  };

  const clearAllFilters = () => {
    setQuery('');
    setLocationQuery('');
    setCategory('All Roles');
    setSystem('All Systems');
    setWorkMode('All');
    setEmploymentType('All');
    setMinSalary(0);
    setSortBy('newest');
    setShowSavedOnly(false);
    setShowTitleSuggestions(false);
    setShowLocationSuggestions(false);
  };

  const activeFilterChips = useMemo(
    () => {
      const chips: Array<{ label: string; onClear: () => void }> = [];
      if (query.trim()) {
        const display = query.length > 26 ? `${query.slice(0, 26)}…` : query;
        chips.push({ label: `Search: ${display}`, onClear: () => setQuery('') });
      }
      if (locationQuery.trim()) {
        const display = locationQuery.length > 22 ? `${locationQuery.slice(0, 22)}…` : locationQuery;
        chips.push({ label: `Location: ${display}`, onClear: () => setLocationQuery('') });
      }
      if (category !== 'All Roles') chips.push({ label: category, onClear: () => setCategory('All Roles') });
      if (system !== 'All Systems') chips.push({ label: system, onClear: () => setSystem('All Systems') });
      if (workMode !== 'All') chips.push({ label: workMode, onClear: () => setWorkMode('All') });
      if (employmentType !== 'All') chips.push({ label: employmentType, onClear: () => setEmploymentType('All') });
      if (minSalary > 0) chips.push({ label: `Min ${formatSalaryFloor(minSalary)}`, onClear: () => setMinSalary(0) });
      if (showSavedOnly) chips.push({ label: 'Saved', onClear: () => setShowSavedOnly(false) });
      return chips;
    },
    [query, locationQuery, category, system, workMode, employmentType, minSalary, showSavedOnly],
  );

  useEffect(() => {
    if (!isDesktop) return;
    if (filteredAndSorted.length === 0) {
      setSelectedJobId(null);
      return;
    }
    if (!selectedJobId) {
      setSelectedJobId(filteredAndSorted[0].id);
      return;
    }
    const stillVisible = filteredAndSorted.some((j) => j.id === selectedJobId);
    if (!stillVisible) {
      setSelectedJobId(filteredAndSorted[0].id);
    }
  }, [filteredAndSorted, isDesktop, selectedJobId]);

  const selectedJob = useMemo(
    () => filteredAndSorted.find((j) => j.id === selectedJobId) || null,
    [filteredAndSorted, selectedJobId],
  );

  const FilterContent = ({ variant }: { variant: "sidebar" | "sheet" }) => (
    <div
      className={[
        variant === "sidebar"
          ? "sticky top-40 max-h-[calc(100vh-10rem)]"
          : "max-h-[70vh]",
        "overflow-hidden rounded-[2.75rem] border border-transparent relative",
      ].join(" ")}
    >
      <div
        ref={filterScrollRef}
        className={[
          "space-y-6 pr-2 pb-24 overflow-y-auto scroll-smooth",
          variant === "sidebar" ? "max-h-[calc(100vh-10rem)]" : "max-h-[70vh]",
        ].join(" ")}
      >
      <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm">
        <div className="sticky top-0 z-10 -mx-2 px-2 pt-2 pb-4 bg-white/95 backdrop-blur rounded-[2rem]">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Expertise Segments</h3>
        </div>
        <div className="space-y-1.5">
          {CATEGORIES.map(cat => (
            <button 
              key={cat} 
              onClick={() => { setCategory(cat); if(window.innerWidth < 1024) setIsFilterOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition-all group ${category === cat ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <span>{cat}</span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${category === cat ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-400'}`}>
                {categoryCounts[cat] || 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm">
        <div className="sticky top-0 z-10 -mx-2 px-2 pt-2 pb-4 bg-white/95 backdrop-blur rounded-[2rem]">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Work Mode</h3>
        </div>
        <div className="space-y-2">
          {workModes.map((mode) => (
            <button
              key={mode}
              onClick={() => setWorkMode(mode)}
              className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
                workMode === mode ? 'bg-slate-900 text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm">
        <div className="sticky top-0 z-10 -mx-2 px-2 pt-2 pb-4 bg-white/95 backdrop-blur rounded-[2rem]">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Employment Type</h3>
        </div>
        <div className="space-y-2">
          {employmentTypes.map((type) => (
            <button
              key={type}
              onClick={() => setEmploymentType(type)}
              className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
                employmentType === type ? 'bg-slate-900 text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm">
        <div className="sticky top-0 z-10 -mx-2 px-2 pt-2 pb-4 bg-white/95 backdrop-blur rounded-[2rem]">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Minimum Salary</h3>
        </div>
        <div className="space-y-2">
          {salaryFloors.map((option) => (
            <button
              key={option.value}
              onClick={() => setMinSalary(option.value)}
              className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
                minSalary === option.value ? 'bg-slate-900 text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm">
        <div className="sticky top-0 z-10 -mx-2 px-2 pt-2 pb-4 bg-white/95 backdrop-blur rounded-[2rem]">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Systems Stack</h3>
        </div>
        <div className="space-y-2">
          {systems.map(s => (
            <button 
              key={s} 
              onClick={() => setSystem(s)}
              className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-bold transition-all ${system === s ? 'bg-slate-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      </div>
      {showFilterTopShadow && (
        <div className="pointer-events-none absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-white to-transparent" />
      )}
      {showFilterBottomShadow && (
        <div className="pointer-events-none absolute bottom-14 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent" />
      )}
      <div className="absolute bottom-0 left-0 right-0 border-t border-slate-100 bg-white/95 backdrop-blur px-4 py-3">
        <button
          onClick={clearAllFilters}
          className="w-full rounded-2xl bg-slate-900 text-white px-4 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-black transition-colors"
        >
          Reset filters ({activeFilterChips.length})
        </button>
      </div>
    </div>
  );

  return (
    <div className="bg-[#F8F9FD]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="sticky top-20 z-40">
          <div className="rounded-[2.25rem] border border-slate-200/60 bg-white/90 backdrop-blur shadow-sm px-4 sm:px-5 py-4">
            <div className="flex flex-col lg:flex-row lg:items-end gap-3 lg:gap-4">
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div ref={titleRef} className="relative">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    Search
                  </label>
                  <div className="relative mt-1.5">
                    <input
                      type="text"
                      placeholder="Role, company, tool…"
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setShowTitleSuggestions(true);
                      }}
                      onFocus={() => setShowTitleSuggestions(true)}
                      autoComplete="off"
                      inputMode="search"
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setQuery("");
                          setShowTitleSuggestions(false);
                        }
                        if (e.key === "Enter") setShowTitleSuggestions(false);
                      }}
                      className="w-full rounded-2xl border border-slate-200/70 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 pr-10"
                    />
                    {query && (
                      <button
                        onClick={() => {
                          setQuery("");
                          setShowTitleSuggestions(false);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-indigo-600"
                        aria-label="Clear search"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                    {showTitleSuggestions && suggestions.length > 0 && (
                      <div className="absolute left-0 right-0 mt-2 bg-white border border-indigo-50 rounded-2xl shadow-2xl overflow-hidden z-40">
                        {suggestions.map((suggestion, idx) => (
                          <button
                            key={`${suggestion}-${idx}`}
                            onClick={() => {
                              setQuery(suggestion);
                              setShowTitleSuggestions(false);
                            }}
                            className="w-full text-left px-4 py-3 text-sm font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors border-b border-indigo-50/50 last:border-none"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div ref={locationRef} className="relative">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    Location
                  </label>
                  <div className="relative mt-1.5">
                    <input
                      type="text"
                      placeholder="City, country, or remote"
                      value={locationQuery}
                      onChange={(e) => {
                        setLocationQuery(e.target.value);
                        setShowLocationSuggestions(true);
                      }}
                      onFocus={() => setShowLocationSuggestions(true)}
                      autoComplete="off"
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setLocationQuery("");
                          setShowLocationSuggestions(false);
                        }
                        if (e.key === "Enter") setShowLocationSuggestions(false);
                      }}
                      className="w-full rounded-2xl border border-slate-200/70 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 pr-10"
                    />
                    {locationQuery && (
                      <button
                        onClick={() => {
                          setLocationQuery("");
                          setShowLocationSuggestions(false);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-indigo-600"
                        aria-label="Clear location"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                    {showLocationSuggestions && locationSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 mt-2 bg-white border border-indigo-50 rounded-2xl shadow-2xl overflow-hidden z-40">
                        {locationSuggestions.map((suggestion, idx) => (
                          <button
                            key={`${suggestion}-${idx}`}
                            onClick={() => {
                              setLocationQuery(suggestion);
                              setShowLocationSuggestions(false);
                            }}
                            className="w-full text-left px-4 py-3 text-sm font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors border-b border-indigo-50/50 last:border-none"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="lg:col-start-3">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    Sort
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="mt-1.5 w-full rounded-2xl border border-slate-200/70 bg-white px-4 py-3 text-sm font-black text-slate-700 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300"
                  >
                    <option value="newest">Newest</option>
                    <option value="salary">Highest salary</option>
                    <option value="match">Best match</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between lg:justify-end gap-3">
                <div className="flex items-center gap-2">
                  {canUseSaved && (
                    <button
                      onClick={() => setShowSavedOnly((prev) => !prev)}
                      disabled={savedCount === 0}
                      aria-pressed={showSavedOnly}
                      className={`h-11 px-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-colors ${
                        showSavedOnly
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-slate-600 border-slate-200/70 hover:border-indigo-200 hover:text-indigo-700"
                      } ${savedCount === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      {showSavedOnly ? "Saved" : `Saved (${savedCount})`}
                    </button>
                  )}
                  <button
                    onClick={clearAllFilters}
                    className="h-11 px-4 rounded-2xl border border-slate-200/70 bg-white text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-indigo-200 hover:text-indigo-700"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => setIsFilterOpen(true)}
                    className="lg:hidden h-11 px-4 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-black"
                  >
                    Filters
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400" aria-live="polite">
                  {filteredAndSorted.length} roles
                </span>
                {(query.trim() || locationQuery.trim()) && (
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                    Showing {query.trim() || "all roles"}{locationQuery.trim() ? ` in ${locationQuery.trim()}` : ""}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {savedNotice && (
                  <span className="text-indigo-600 font-bold text-xs" aria-live="polite">
                    {savedNotice}
                  </span>
                )}
                <button
                  onClick={handleSaveSearch}
                  disabled={(!query.trim() && !locationQuery.trim()) || isSaving}
                  className="text-indigo-600 font-black uppercase tracking-widest text-[10px] hover:text-indigo-800 disabled:text-slate-300"
                >
                  {isSaving ? "Saving..." : accessToken ? "Save alert" : "Sign in to save"}
                </button>
              </div>
            </div>

            {activeFilterChips.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {activeFilterChips.slice(0, 6).map((chip, index) => (
                  <button
                    key={`${chip.label}-${index}`}
                    onClick={chip.onClear}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:border-indigo-200 hover:text-indigo-600"
                  >
                    {chip.label}
                    <span className="text-[10px]">×</span>
                  </button>
                ))}
                {activeFilterChips.length > 6 && (
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                    +{activeFilterChips.length - 6} more
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <aside className="hidden lg:block lg:col-span-3">
            <FilterContent variant="sidebar" />
          </aside>

          <div className="lg:col-span-5 space-y-3">
            {filteredAndSorted.slice(0, visibleCount).map((job) => {
              const isSaved = user?.savedJobIds?.includes(job.id);
              const selected = isDesktop && selectedJobId === job.id;

              return (
                <JobRow
                  key={job.id}
                  job={job}
                  selected={selected}
                  isSaved={Boolean(isSaved)}
                  showSave={Boolean(canUseSaved)}
                  onToggleSave={() => onToggleBookmark(job.id)}
                  onOpenCompany={(companyName) => {
                    if (onSelectCompany) onSelectCompany(companyName);
                    else router.push(`/companies/${createCompanySlug({ name: companyName })}`);
                  }}
                  onSelect={() => {
                    if (isDesktop) {
                      setSelectedJobId(job.id);
                      return;
                    }
                    router.push(`/jobs/${createJobSlug(job)}`);
                  }}
                  onApply={() => handleApply(job)}
                />
              );
            })}

            {filteredAndSorted.length > visibleCount && (
              <div className="pt-4 pb-2 text-center">
                <button
                  onClick={handleLoadMore}
                  className="bg-white border border-slate-200/70 text-slate-700 px-6 py-3 rounded-[2rem] font-black uppercase tracking-widest text-[10px] hover:border-indigo-200 hover:text-indigo-700 transition-all shadow-sm active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
                >
                  Show more ({filteredAndSorted.length - visibleCount} remaining)
                </button>
              </div>
            )}

            {filteredAndSorted.length === 0 && (
              <div className="bg-white py-12 rounded-[3rem] text-center border border-dashed border-slate-200/70">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  No matches
                </div>
                <p className="mt-3 text-slate-700 font-black text-lg">
                  {showSavedOnly ? "No saved roles yet." : "No roles match your current filters."}
                </p>
                <p className="mt-2 text-slate-500 font-medium">
                  Try fewer keywords, broaden location, or reset filters. You can also save this search as an alert.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                  {["Notion", "RevOps", "Automation", "Remote", "Airtable"].map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setQuery(tag)}
                      className="px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest text-slate-600 border border-slate-200 bg-slate-50 hover:border-indigo-200 hover:text-indigo-700"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <div className="mt-6 flex items-center justify-center gap-3">
                  <button
                    onClick={clearAllFilters}
                    className="h-11 px-5 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-black"
                  >
                    Reset filters
                  </button>
                  <button
                    onClick={() => (accessToken ? handleSaveSearch() : router.push("/auth"))}
                    className="h-11 px-5 rounded-2xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100"
                  >
                    {accessToken ? "Save alert" : "Sign in for alerts"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <aside className="hidden lg:block lg:col-span-4">
            <JobDetailPanel
              job={selectedJob}
              allJobs={filteredAndSorted}
              onClose={() => setSelectedJobId(null)}
              onApply={handleApply}
              onToggleSave={canUseSaved ? onToggleBookmark : undefined}
              isSaved={(jobId) => Boolean(user?.savedJobIds?.includes(jobId))}
            />
          </aside>
        </div>
      </div>

      {isFilterOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Filters"
          onClick={() => setIsFilterOpen(false)}
        >
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-2xl rounded-t-[2.75rem] border border-slate-200 bg-[#F8F9FD] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-5 pb-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Filters</div>
                <div className="text-sm font-black text-slate-900 mt-1">{filteredAndSorted.length} roles</div>
              </div>
              <button
                onClick={() => setIsFilterOpen(false)}
                className="h-11 w-11 rounded-2xl border border-slate-200/70 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-700 flex items-center justify-center"
                aria-label="Close filters"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-4 pb-4">
              <FilterContent variant="sheet" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FindJobs;
