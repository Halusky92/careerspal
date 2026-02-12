"use client";


import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Job, UserSession } from '../types';
import { createCompanySlug, createJobSlug } from '../lib/jobs';
import { CATEGORIES } from '../constants';
import { useSupabaseAuth } from "./Providers";
import { authFetch } from "../lib/authFetch";
import CompanyLogo from "./CompanyLogo";

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
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showTitleSuggestions, setShowTitleSuggestions] = useState(false);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState('');
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const mobileTitleRef = useRef<HTMLDivElement>(null);
  const mobileLocationRef = useRef<HTMLDivElement>(null);
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
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
      if (mobileTitleRef.current && !mobileTitleRef.current.contains(event.target as Node)) {
        setShowTitleSuggestions(false);
      }
      if (mobileLocationRef.current && !mobileLocationRef.current.contains(event.target as Node)) {
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

  // Helper to check for "New" badge
  const isNewListing = (postedAt: string) => {
    const lower = postedAt.toLowerCase();
    return lower.includes('just now') || lower.includes('hour') || lower.includes('min');
  };

const sanitizeDescription = (value?: string | null) => {
  if (!value) return "";
  const lines = value.split("\n");
  const cleaned = lines.filter((line) => {
    const trimmed = line.trim().toLowerCase();
    if (!trimmed) return true;
    if (trimmed.startsWith("import-") || trimmed.startsWith("import/")) return false;
    if (trimmed.includes("import-") && !trimmed.includes(" ")) return false;
    return true;
  });
  return cleaned.join("\n").trim();
};

  const formatPostedDate = (job: Job) => {
    if (!job.timestamp) return job.postedAt;
    const date = new Date(job.timestamp);
    return Number.isNaN(date.getTime()) ? job.postedAt : date.toLocaleDateString();
  };

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + JOBS_PER_PAGE);
  };
  const handleToggleJob = (job: Job) => {
    if (job.status === 'private' || job.status === 'invite_only') return;
    setExpandedJobId((prev) => (prev === job.id ? null : job.id));
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
    setShowSuggestions(false);
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

  const FilterContent = () => (
    <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-hidden rounded-[2.75rem] border border-transparent relative">
      <div
        ref={filterScrollRef}
        className="space-y-6 pr-2 pb-24 max-h-[calc(100vh-7rem)] overflow-y-auto scroll-smooth"
      >
      <div ref={searchRef} className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm">
        <div className="sticky top-0 z-10 -mx-2 px-2 pt-2 pb-4 bg-white/95 backdrop-blur rounded-2xl">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Search</h3>
        </div>
        <div className="space-y-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search role, company, tool…"
              className="w-full rounded-xl border border-slate-200/70 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 pr-10"
              inputMode="search"
              autoComplete="off"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setQuery("");
                  setShowSuggestions(false);
                }
                if (e.key === "Enter") {
                  setShowSuggestions(false);
                }
              }}
            />
            {query && (
              <button
                onClick={() => {
                  setQuery("");
                  setShowSuggestions(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-indigo-600"
                aria-label="Clear search"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-indigo-50 rounded-2xl shadow-2xl overflow-hidden z-40">
                {suggestions.map((suggestion, idx) => (
                  <button
                    key={`${suggestion}-${idx}`}
                    onClick={() => {
                      setQuery(suggestion);
                      setShowSuggestions(false);
                    }}
                    className="w-full text-left px-4 py-3 text-sm font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors border-b border-indigo-50/50 last:border-none"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Location (optional)…"
              className="w-full rounded-xl border border-slate-200/70 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 pr-10"
              autoComplete="off"
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setLocationQuery("");
              }}
            />
            {locationQuery && (
              <button
                onClick={() => setLocationQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-indigo-600"
                aria-label="Clear location"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400" aria-live="polite">
              {filteredAndSorted.length} roles
            </span>
            <button
              onClick={clearAllFilters}
              className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="px-2">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Jobs
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            {filteredAndSorted.length} roles • screened employers • response SLA 2 days
          </p>
        </div>

        <div className="flex items-center gap-3 px-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sort</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-700 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300"
            >
              <option value="newest">Newest</option>
              <option value="salary">Highest salary</option>
              <option value="match">Best match</option>
            </select>
          </div>
          <button
            onClick={clearAllFilters}
            className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row-reverse gap-12">
        <aside className="hidden lg:block lg:w-80 space-y-10 relative">
          <FilterContent />
        </aside>

        <div className="flex-1 space-y-6">

          <div className="flex flex-wrap items-center gap-2 px-2">
            {CATEGORIES.filter((c) => c !== "All Roles").slice(0, 6).map((cat) => (
              <button
                key={`top-${cat}`}
                onClick={() => setCategory(cat)}
                className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
                  category === cat
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-slate-500 border-slate-200 hover:border-indigo-200 hover:text-indigo-600"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 px-2">
            {Object.entries(typeCounts).map(([type, count]) => (
              <span
                key={`type-${type}`}
                className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-slate-200 bg-white text-slate-500"
              >
                {type} · {count}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 px-2">
            {canUseSaved && (
              <button
                onClick={() => setShowSavedOnly((prev) => !prev)}
                disabled={savedCount === 0}
                aria-pressed={showSavedOnly}
                className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border transition-colors ${
                  showSavedOnly
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-200 hover:text-indigo-600'
                } ${savedCount === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {showSavedOnly ? 'Showing saved' : `Saved (${savedCount})`}
              </button>
            )}
          </div>
          <div className="lg:hidden">
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm px-5 py-4 space-y-4">
              <div ref={mobileTitleRef} className="relative">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Job title</label>
                <div className="relative mt-2">
                  <input
                    type="text"
                    placeholder="e.g. Operations Manager"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setShowTitleSuggestions(true); }}
                    onFocus={() => setShowTitleSuggestions(true)}
                    autoComplete="off"
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setQuery('');
                        setShowTitleSuggestions(false);
                      }
                      if (e.key === 'Enter') {
                        setShowTitleSuggestions(false);
                      }
                    }}
                    className="w-full rounded-xl border border-slate-200/70 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 pr-10"
                  />
                  {query && (
                    <button
                      onClick={() => { setQuery(''); setShowTitleSuggestions(false); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-indigo-600"
                      aria-label="Clear job title"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
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
              <div ref={mobileLocationRef} className="relative">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</label>
                <div className="relative mt-2">
                  <input
                    type="text"
                    placeholder="City, country or remote"
                    value={locationQuery}
                    onChange={(e) => { setLocationQuery(e.target.value); setShowLocationSuggestions(true); }}
                    onFocus={() => setShowLocationSuggestions(true)}
                    autoComplete="off"
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setLocationQuery('');
                        setShowLocationSuggestions(false);
                      }
                      if (e.key === 'Enter') {
                        setShowLocationSuggestions(false);
                      }
                    }}
                    className="w-full rounded-xl border border-slate-200/70 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 pr-10"
                  />
                  {locationQuery && (
                    <button
                      onClick={() => { setLocationQuery(''); setShowLocationSuggestions(false); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-indigo-600"
                      aria-label="Clear location"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
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
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Work mode</label>
                <select
                  value={workMode}
                  onChange={(e) => setWorkMode(e.target.value as typeof workMode)}
                  className="mt-2 w-full rounded-xl border border-slate-200/70 px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300"
                >
                  {workModes.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {filteredAndSorted.length} roles
                </span>
                <button
                  onClick={clearAllFilters}
                  className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800"
                >
                  Clear filters
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 px-2">
            <span className="font-semibold" aria-live="polite">
              {filteredAndSorted.length} roles found
            </span>
            <div className="flex items-center gap-3">
              {savedNotice && (
                <span className="text-indigo-600 font-bold" aria-live="polite">
                  {savedNotice}
                </span>
              )}
              <button
                onClick={handleSaveSearch}
                disabled={(!query.trim() && !locationQuery.trim()) || isSaving}
                className="text-indigo-600 font-black uppercase tracking-widest text-[10px] hover:text-indigo-800 disabled:text-slate-300"
              >
                {isSaving ? 'Saving...' : 'Save search'}
              </button>
            </div>
          </div>
          <div className="px-2 mt-2 text-[10px] font-black uppercase tracking-widest text-slate-300">
            Tip: Use two keywords for sharper matches.
          </div>
          {(query.trim() || locationQuery.trim()) && (
            <div className="px-2 mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
              Showing results for {query.trim() || 'all roles'}
              {locationQuery.trim() ? ` in ${locationQuery.trim()}` : ''}
            </div>
          )}

          {activeFilterChips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 px-2">
              {activeFilterChips.map((chip, index) => (
                <button
                  key={`${chip.label}-${index}`}
                  onClick={chip.onClear}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:border-indigo-200 hover:text-indigo-600"
                >
                  {chip.label}
                  <span className="text-[10px]">×</span>
                </button>
              ))}
              <button
                onClick={clearAllFilters}
                className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800"
              >
                Clear all
              </button>
            </div>
          )}

          <div className="space-y-5">
            {filteredAndSorted.slice(0, visibleCount).map(job => {
              const isElite = job.planType === 'Elite Managed';
              const isPro = job.planType === 'Featured Pro';
              const isStandard = !isElite && !isPro;
              const isNew = isNewListing(job.postedAt);
              const isPrivate = job.status === 'private' || job.status === 'invite_only';
              // Check if job is saved in the user object
              const isSaved = user?.savedJobIds?.includes(job.id);
              const salaryStats = getSalaryLevel(job.salary);
              const workModeLabel = getWorkMode(job);
              const hasApplyUrl = Boolean(job.applyUrl && job.applyUrl.trim() && job.applyUrl !== '#');

              return (
                <div 
                key={job.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  handleToggleJob(job);
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  handleToggleJob(job);
                }}
                  className={`
                    p-4 rounded-2xl transition-all cursor-pointer group flex flex-col items-stretch justify-between gap-3 relative active:scale-[0.99] animate-in fade-in slide-in-from-bottom-2
                    ${isElite 
                      ? 'bg-amber-50 border border-amber-200 shadow-sm text-slate-900 border-l-4 border-l-amber-400' 
                      : isPro 
                        ? 'bg-white border border-amber-200 shadow-sm border-l-4 border-l-amber-400'
                        : 'bg-white border border-amber-200 shadow-sm hover:shadow-md border-l-4 border-l-amber-300'}
                    ${isPrivate ? 'opacity-70' : ''}
                  `}
                >
                  {/* Badges for Elite/Pro */}
                  {(isElite || isPro) && (
                    <div className={`absolute -top-2 left-4 sm:left-7 px-2.5 py-1 rounded-full text-[7px] font-black uppercase tracking-widest shadow-md
                      ${isElite ? 'bg-yellow-200 text-yellow-900' : 'bg-indigo-600 text-white'}`}>
                      {isElite ? 'Elite Managed' : 'Featured'}
                    </div>
                  )}

                  {/* New Listing Badge - Adjusted Position */}
                  {isNew && (
                    <div className="absolute -top-2 right-3 sm:right-8 animate-pulse z-20">
                      <span className="bg-red-500 text-white text-[7px] font-black px-2 py-1 rounded-full uppercase tracking-widest shadow-red-200 shadow-lg border-2 border-white">New</span>
                    </div>
                  )}
                  {isPrivate && (
                    <div className="absolute -top-2 right-20 sm:right-28 z-20">
                      <span className="bg-slate-900 text-white text-[7px] font-black px-2 py-1 rounded-full uppercase tracking-widest shadow-lg">Invite Only</span>
                    </div>
                  )}

                  {/* Bookmark Button - MOVED HIGHER (top-2) */}
                  <button 
                     onClick={(e) => { e.stopPropagation(); onToggleBookmark(job.id); }}
                     className={`absolute top-2 right-2 sm:right-3 p-1 sm:p-1.5 rounded-full transition-all z-30 hover:scale-110
                       ${isSaved 
                         ? 'text-pink-500 bg-pink-50' 
                         : isElite ? 'text-yellow-700 hover:text-yellow-900 hover:bg-yellow-100' : 'text-slate-300 hover:text-pink-400 hover:bg-pink-50'
                       }`}
                     title={isSaved ? "Saved" : "Save"}
                     aria-pressed={isSaved ? 'true' : 'false'}
                     aria-label={isSaved ? 'Remove bookmark' : 'Save job'}
                  >
                     <svg className="w-3.5 h-3.5" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                  </button>

                  <div className="flex items-start gap-4 w-full">
                    <div
                      className={`
                      w-11 h-11 sm:w-14 sm:h-14 rounded-[1rem] sm:rounded-[1.3rem] flex items-center justify-center overflow-hidden p-1 flex-shrink-0
                      ${isElite ? 'bg-yellow-100 border border-yellow-200' : 'bg-gray-50 border border-gray-100'}
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
                    
                    {/* Added pr to prevent overlap with heart button */}
                    <div className="flex-1 min-w-0 pr-9">
                      <h3 className={`text-base sm:text-lg font-black tracking-tight leading-tight truncate ${isElite ? 'text-slate-900 group-hover:text-yellow-700' : 'text-slate-900 group-hover:text-indigo-600'} transition-colors`}>
                        {job.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 flex-nowrap overflow-hidden">
                        <button 
                           onClick={(e) => { 
                             e.stopPropagation(); 
                             if (onSelectCompany) {
                               onSelectCompany(job.company);
                             } else {
                               router.push(`/companies/${createCompanySlug({ name: job.company })}`);
                             }
                           }}
                           className={`font-bold uppercase text-[9px] sm:text-[10px] tracking-wider hover:underline z-10 relative truncate ${isElite ? 'text-yellow-700' : 'text-indigo-600'}`}
                        >
                           {job.company}
                        </button>
                        <span className={`text-[8px] flex-shrink-0 ${isElite ? 'text-yellow-300' : 'text-slate-300'}`}>•</span>
                        <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-widest truncate ${isElite ? 'text-yellow-700' : 'text-slate-400'}`}>
                          {job.location}
                        </span>
                        <span className={`text-[7px] sm:text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${isElite ? 'text-yellow-700 border-yellow-200 bg-yellow-50' : 'text-slate-500 border-slate-200 bg-slate-50'}`}>
                          {workModeLabel}
                        </span>
                      </div>
                      <div className="flex gap-2 mt-2.5 flex-wrap">
                        {(job.tools || []).slice(0, 3).map((tool) => (
                          <span key={tool} className={`
                            text-[7px] font-black px-2 py-1 rounded-lg border uppercase tracking-widest
                            ${isElite ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-slate-50 text-slate-400 border-slate-100'}
                          `}>
                            {tool}
                          </span>
                        ))}
                        {(job.tools || []).length > 3 && (
                          <span
                            className={`text-[7px] font-black px-2 py-1 rounded-lg border uppercase tracking-widest ${
                              isElite ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-slate-50 text-slate-400 border-slate-100'
                            }`}
                          >
                            +{(job.tools || []).length - 3}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="text-[7px] font-black uppercase tracking-widest px-2 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
                          Verified Employer
                        </span>
                        {!isStandard && (
                          <span className="text-[7px] font-black uppercase tracking-widest px-2 py-1 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-600">
                            Response SLA 2d
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="w-full border-t border-slate-100 pt-3 flex items-center justify-between gap-3">
                    <div className={`text-base sm:text-lg font-black tracking-tight whitespace-nowrap ${isElite ? 'text-yellow-900' : 'text-slate-900'}`}>
                      {job.salary}
                    </div>

                    <button
                      onClick={async (event) => {
                        event.stopPropagation();
                        if (isPrivate) {
                          router.push('/auth');
                          return;
                        }
                        if (!hasApplyUrl) return;
                        try {
                          await fetch(`/api/jobs/${job.id}/match`, { method: "POST" });
                        } catch {
                          // no-op
                        }
                        window.open(job.applyUrl, '_blank', 'noopener,noreferrer');
                      }}
                      disabled={!isPrivate && !hasApplyUrl}
                      className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-[9px] font-black uppercase tracking-widest transition-all w-full md:w-auto ${
                        isElite
                          ? 'bg-yellow-200 text-yellow-900 hover:bg-yellow-300'
                          : hasApplyUrl
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {isPrivate ? 'Request access' : hasApplyUrl ? 'Quick apply' : 'Apply soon'}
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-1">
                    <span className={`text-[7px] sm:text-[8px] font-black uppercase tracking-widest ${isElite ? 'text-yellow-700' : 'text-slate-300'}`}>{formatPostedDate(job)}</span>
                    {job.matchScore && (
                      <span className={`text-[7px] sm:text-[8px] font-black px-2 py-1 rounded-lg border ${isElite ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}>Match {job.matchScore}%</span>
                    )}
                  </div>
                  {expandedJobId === job.id && (
                    <div className="w-full bg-slate-50 border border-slate-100 rounded-[1.5rem] sm:rounded-[2rem] p-4 sm:p-6 text-left">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Role overview</p>
                        <p className="text-sm sm:text-base text-slate-700 mt-2 whitespace-pre-wrap">
                          {sanitizeDescription(job.description) || "Description coming soon."}
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
                          <span className="text-[9px] uppercase tracking-widest text-slate-400">Work mode</span>
                          <div className="mt-1">{workModeLabel}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <span className="text-[9px] uppercase tracking-widest text-slate-400">Employment type</span>
                          <div className="mt-1">{job.type || "N/A"}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <span className="text-[9px] uppercase tracking-widest text-slate-400">Salary</span>
                          <div className="mt-1">{job.salary || "N/A"}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                          <span className="text-[9px] uppercase tracking-widest text-slate-400">Posted</span>
                          <div className="mt-1">{formatPostedDate(job)}</div>
                        </div>
                      </div>
                      {/* Full details CTA temporarily hidden; keep placement for later */}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Load More Button */}
            {filteredAndSorted.length > visibleCount && (
               <div className="pt-8 pb-4 text-center">
                  <button 
                     onClick={handleLoadMore}
                     className="bg-white border-2 border-slate-100 text-slate-600 px-6 sm:px-8 py-3 sm:py-4 rounded-[2rem] font-black uppercase tracking-widest text-[10px] sm:text-xs hover:border-indigo-600 hover:text-indigo-600 transition-all shadow-sm active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100"
                  >
                     Show More Roles ({filteredAndSorted.length - visibleCount} remaining)
                  </button>
               </div>
            )}

            {filteredAndSorted.length === 0 && (
              <div className="bg-white py-16 rounded-[3.5rem] text-center border-2 border-dashed border-slate-100">
                <p className="text-slate-400 font-bold italic">
                  {showSavedOnly ? 'No saved roles yet.' : 'No elite roles found matching your current search.'}
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                  {["Notion", "Ops Manager", "Remote", "Automation", "Zapier"].map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setQuery(tag)}
                      className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-slate-500 border border-slate-200 bg-slate-50 hover:border-indigo-200 hover:text-indigo-600"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <button
                  onClick={clearAllFilters}
                  className="mt-6 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FindJobs;
