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
}

const JOBS_PER_PAGE = 7;

const TOOL_OPTIONS = ["Notion", "Airtable", "Zapier", "Make"] as const;
const SENIORITY_OPTIONS = ["any", "junior", "mid", "senior", "lead"] as const;
const TZ_OPTIONS = ["any", "eu", "us"] as const;

type SortOption = "newest" | "salary" | "relevant";
type SeniorityOption = (typeof SENIORITY_OPTIONS)[number];
type TzOption = (typeof TZ_OPTIONS)[number];

const parseNumberParam = (value: string | null, fallback: number) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const parseCsvParam = (value: string | null) => {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
};

const inferSeniority = (job: Job): Exclude<SeniorityOption, "any"> | "unknown" => {
  const t = (job.title || "").toLowerCase();
  if (t.includes("intern") || t.includes("junior") || t.includes("jr")) return "junior";
  if (t.includes("principal") || t.includes("head") || t.includes("director") || t.includes("vp ")) return "lead";
  if (t.includes("lead") || t.includes("staff")) return "lead";
  if (t.includes("senior") || t.includes("sr")) return "senior";
  if (t.includes("mid")) return "mid";
  return "unknown";
};

const inferTimezoneBucket = (job: Job): Exclude<TzOption, "any"> | "unknown" => {
  const text = `${job.location || ""} ${job.remotePolicy || ""} ${(job.description || "").slice(0, 1200)}`.toLowerCase();
  const euHints = ["europe", "emea", "eu ", "uk", "gmt", "cet", "cest", "eet", "bst", "london", "berlin", "paris", "amsterdam", "dublin"];
  const usHints = ["united states", "usa", "us ", "america", "est", "edt", "pst", "pdt", "cst", "cdt", "mst", "mdt", " et", " pt", "nyc", "san francisco"];
  if (euHints.some((h) => text.includes(h))) return "eu";
  if (usHints.some((h) => text.includes(h))) return "us";
  return "unknown";
};

const getToolSignals = (job: Job) => {
  const raw = [...(job.tools || []), ...(job.tags || [])].filter(Boolean);
  const normalized = raw.map((v) => v.toLowerCase());
  return new Set(normalized);
};

const FindJobs: React.FC<FindJobsProps> = ({
  jobs,
  onSelectJob,
  onSelectCompany,
  initialQuery = '',
  initialLocationQuery = '',
  user,
  onToggleBookmark,
}) => {
  const router = useRouter();
  const { accessToken } = useSupabaseAuth();
  const [query, setQuery] = useState(initialQuery);
  const [locationQuery, setLocationQuery] = useState(initialLocationQuery);
  const [category, setCategory] = useState('All Roles');
  const [workMode, setWorkMode] = useState<'All' | 'Remote' | 'Hybrid' | 'Onsite'>('All');
  const [employmentType, setEmploymentType] = useState<'All' | Job['type']>('All');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [salaryMin, setSalaryMin] = useState(0);
  const [salaryMax, setSalaryMax] = useState(0);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [timezone, setTimezone] = useState<TzOption>("any");
  const [seniority, setSeniority] = useState<SeniorityOption>("any");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showTitleSuggestions, setShowTitleSuggestions] = useState(false);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const titleRef = useRef<HTMLDivElement>(null);
  const locationRef = useRef<HTMLDivElement>(null);
  const filterScrollRef = useRef<HTMLDivElement>(null);
  const [showFilterTopShadow, setShowFilterTopShadow] = useState(false);
  const [showFilterBottomShadow, setShowFilterBottomShadow] = useState(false);
  const hydratedRef = useRef(false);
  
  // Pagination State
  const [visibleCount, setVisibleCount] = useState(JOBS_PER_PAGE);

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
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const urlQuery = params.get("query");
    const urlLocation = params.get("location");
    const urlCategory = params.get("category");
    const urlWorkMode = params.get("workMode");
    const urlType = params.get("type");
    const urlSort = params.get("sort");
    const urlSalaryMin = params.get("salaryMin");
    const urlSalaryMax = params.get("salaryMax");
    const urlTools = params.get("tools");
    const urlTz = params.get("tz");
    const urlSeniority = params.get("seniority");
    const urlVerified = params.get("verified");
    const urlSaved = params.get("saved");

    if (typeof urlQuery === "string" && urlQuery !== query) setQuery(urlQuery);
    if (typeof urlLocation === "string" && urlLocation !== locationQuery) setLocationQuery(urlLocation);
    if (urlCategory && CATEGORIES.includes(urlCategory)) setCategory(urlCategory);
    if (urlWorkMode && workModes.includes(urlWorkMode as any)) setWorkMode(urlWorkMode as any);
    if (urlType && employmentTypes.includes(urlType as any)) setEmploymentType(urlType as any);
    if (urlSort && (urlSort === "newest" || urlSort === "salary" || urlSort === "relevant")) setSortBy(urlSort);
    setSalaryMin(Math.max(0, parseNumberParam(urlSalaryMin, 0)));
    setSalaryMax(Math.max(0, parseNumberParam(urlSalaryMax, 0)));
    const tools = parseCsvParam(urlTools).filter((t) => TOOL_OPTIONS.includes(t as any));
    setSelectedTools(tools);
    if (urlTz && (urlTz === "any" || urlTz === "eu" || urlTz === "us")) setTimezone(urlTz);
    if (urlSeniority && SENIORITY_OPTIONS.includes(urlSeniority as any)) setSeniority(urlSeniority as any);
    setVerifiedOnly(urlVerified === "1");
    setShowSavedOnly(urlSaved === "1");

    hydratedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hydratedRef.current) return;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const setOrDelete = (key: string, value: string | null) => {
        if (value && value.trim()) params.set(key, value);
        else params.delete(key);
      };
      setOrDelete("query", query.trim() || null);
      setOrDelete("location", locationQuery.trim() || null);
      setOrDelete("category", category !== "All Roles" ? category : null);
      setOrDelete("workMode", workMode !== "All" ? workMode : null);
      setOrDelete("type", employmentType !== "All" ? employmentType : null);
      setOrDelete("sort", sortBy !== "newest" ? sortBy : null);
      setOrDelete("salaryMin", salaryMin > 0 ? String(salaryMin) : null);
      setOrDelete("salaryMax", salaryMax > 0 ? String(salaryMax) : null);
      setOrDelete("tools", selectedTools.length > 0 ? selectedTools.join(",") : null);
      setOrDelete("tz", timezone !== "any" ? timezone : null);
      setOrDelete("seniority", seniority !== "any" ? seniority : null);
      setOrDelete("verified", verifiedOnly ? "1" : null);
      setOrDelete("saved", showSavedOnly ? "1" : null);
      const qs = params.toString();
      router.replace(qs ? `/jobs?${qs}` : "/jobs", { scroll: false });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [
    query,
    locationQuery,
    category,
    workMode,
    employmentType,
    sortBy,
    salaryMin,
    salaryMax,
    selectedTools,
    timezone,
    seniority,
    verifiedOnly,
    showSavedOnly,
    router,
  ]);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(JOBS_PER_PAGE);
    setExpandedJobId(null);
  }, [
    query,
    locationQuery,
    category,
    sortBy,
    workMode,
    employmentType,
    salaryMin,
    salaryMax,
    selectedTools,
    timezone,
    seniority,
    verifiedOnly,
    showSavedOnly,
  ]);

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

  const toolCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    TOOL_OPTIONS.forEach((tool) => {
      counts[tool] = 0;
    });
    jobs.forEach((job) => {
      const signals = getToolSignals(job);
      TOOL_OPTIONS.forEach((tool) => {
        const low = tool.toLowerCase();
        const hit = low === "make" ? (signals.has("make") || signals.has("make.com")) : signals.has(low);
        if (hit) counts[tool] = (counts[tool] || 0) + 1;
      });
    });
    return counts;
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
      const matchesWorkMode = workMode === 'All' || getWorkMode(j) === workMode;
      const matchesEmployment = employmentType === 'All' || j.type === employmentType;
      const salaryRange = parseSalaryRange(j.salary);
      const matchesSaved = !showSavedOnly || savedIds.has(j.id);
      const matchesSalaryMin = salaryMin === 0 || salaryRange.max >= salaryMin;
      const matchesSalaryMax = salaryMax === 0 || salaryRange.min <= salaryMax;
      const toolSignals = getToolSignals(j);
      const matchesTools =
        selectedTools.length === 0 ||
        selectedTools.some((tool) => {
          const low = tool.toLowerCase();
          if (low === "make") return toolSignals.has("make") || toolSignals.has("make.com");
          return toolSignals.has(low);
        });
      const bucket = inferTimezoneBucket(j);
      const matchesTz = timezone === "any" ? true : bucket === timezone || bucket === "unknown";
      const inferredSeniority = inferSeniority(j);
      const matchesSeniority =
        seniority === "any" ? true : inferredSeniority === seniority || inferredSeniority === "unknown";
      const matchesVerified = !verifiedOnly || Boolean(j.companyVerified);

      return (
        matchesQuery &&
        matchesLocation &&
        matchesCat &&
        matchesWorkMode &&
        matchesEmployment &&
        matchesSalaryMin &&
        matchesSalaryMax &&
        matchesSaved &&
        matchesTools &&
        matchesTz &&
        matchesSeniority &&
        matchesVerified
      );
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

      if (sortBy === 'relevant') {
        const q = query.trim().toLowerCase();
        const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
        const score = (job: Job) => {
          const base = job.matchScore ?? 0;
          if (tokens.length === 0) return base;
          const hay = `${job.title} ${job.company} ${(job.tags || []).join(" ")} ${(job.tools || []).join(" ")}`.toLowerCase();
          const hit = tokens.reduce((acc, t) => (hay.includes(t) ? acc + 10 : acc), 0);
          const toolBonus = selectedTools.reduce((acc, t) => {
            const low = t.toLowerCase();
            const signals = getToolSignals(job);
            if (low === "make") return acc + (signals.has("make") || signals.has("make.com") ? 6 : 0);
            return acc + (signals.has(low) ? 6 : 0);
          }, 0);
          const seniorityBonus =
            seniority !== "any" && inferSeniority(job) === seniority ? 6 : 0;
          return base + hit + toolBonus + seniorityBonus;
        };
        return score(b) - score(a);
      }
      
      // Secondary Sort: Date (Newest First) if weights are equal and not sorting by salary
      const timeA = a.timestamp ?? 0;
      const timeB = b.timestamp ?? 0;
      return timeB - timeA;
    });
    
    return result;
  }, [
    jobs,
    query,
    locationQuery,
    category,
    sortBy,
    workMode,
    employmentType,
    salaryMin,
    salaryMax,
    selectedTools,
    timezone,
    seniority,
    verifiedOnly,
    showSavedOnly,
  ]);

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
    setWorkMode('All');
    setEmploymentType('All');
    setSortBy('newest');
    setSalaryMin(0);
    setSalaryMax(0);
    setSelectedTools([]);
    setTimezone("any");
    setSeniority("any");
    setVerifiedOnly(false);
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
      if (workMode !== 'All') chips.push({ label: workMode, onClear: () => setWorkMode('All') });
      if (employmentType !== 'All') chips.push({ label: employmentType, onClear: () => setEmploymentType('All') });
      if (salaryMin > 0) chips.push({ label: `Min ${formatSalaryFloor(salaryMin)}`, onClear: () => setSalaryMin(0) });
      if (salaryMax > 0) chips.push({ label: `Max ${formatSalaryFloor(salaryMax)}`, onClear: () => setSalaryMax(0) });
      if (selectedTools.length > 0) chips.push({ label: `Tools: ${selectedTools.join(", ")}`, onClear: () => setSelectedTools([]) });
      if (timezone !== "any") chips.push({ label: timezone === "eu" ? "EU-friendly" : "US-friendly", onClear: () => setTimezone("any") });
      if (seniority !== "any") chips.push({ label: `Seniority: ${seniority}`, onClear: () => setSeniority("any") });
      if (verifiedOnly) chips.push({ label: "Verified only", onClear: () => setVerifiedOnly(false) });
      if (showSavedOnly) chips.push({ label: 'Saved', onClear: () => setShowSavedOnly(false) });
      return chips;
    },
    [query, locationQuery, category, workMode, employmentType, salaryMin, salaryMax, selectedTools, timezone, seniority, verifiedOnly, showSavedOnly],
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
              <span className="flex-1 min-w-0 text-left truncate" title={cat}>{cat}</span>
              <span className={`flex-shrink-0 text-[10px] font-black px-2 py-0.5 rounded-lg ${category === cat ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-400'}`}>
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
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Salary range</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-slate-200/60 bg-slate-50 px-4 py-3">
            <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Min</div>
            <div className="text-sm font-black text-slate-900 mt-1">{formatSalaryFloor(salaryMin)}</div>
          </div>
          <div className="rounded-2xl border border-slate-200/60 bg-slate-50 px-4 py-3">
            <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Max</div>
            <div className="text-sm font-black text-slate-900 mt-1">{salaryMax > 0 ? formatSalaryFloor(salaryMax) : "Any"}</div>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {salaryFloors.map((option) => (
              <button
                key={option.value}
                onClick={() => setSalaryMin(option.value)}
                className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-colors ${
                  salaryMin === option.value
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:border-indigo-200 hover:text-indigo-700"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Min slider</label>
            <input
              type="range"
              min={0}
              max={250000}
              step={5000}
              value={salaryMin}
              onChange={(e) => {
                const next = Math.max(0, Number(e.target.value) || 0);
                setSalaryMin(next);
                if (salaryMax > 0 && next > salaryMax) setSalaryMax(next);
              }}
              className="mt-2 w-full accent-indigo-600"
            />
          </div>

          <div className="grid grid-cols-1 gap-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Max cap</label>
            <select
              value={salaryMax}
              onChange={(e) => {
                const next = Number(e.target.value) || 0;
                setSalaryMax(next);
                if (next > 0 && salaryMin > next) setSalaryMin(next);
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[11px] font-black text-slate-700 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300"
            >
              <option value={0}>Any</option>
              <option value={100000}>$100k</option>
              <option value={120000}>$120k</option>
              <option value={150000}>$150k</option>
              <option value={180000}>$180k</option>
              <option value={200000}>$200k</option>
              <option value={250000}>$250k</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm">
        <div className="sticky top-0 z-10 -mx-2 px-2 pt-2 pb-4 bg-white/95 backdrop-blur rounded-[2rem]">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Tools</h3>
        </div>
        <div className="space-y-2">
          {TOOL_OPTIONS.map((tool) => {
            const active = selectedTools.includes(tool);
            return (
              <button
                key={tool}
                onClick={() => {
                  setSelectedTools((prev) => (prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]));
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
                  active ? "bg-indigo-600 text-white shadow-xl shadow-indigo-100" : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                <span>{tool}</span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-400"}`}>
                  {toolCounts[tool] || 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm">
        <div className="sticky top-0 z-10 -mx-2 px-2 pt-2 pb-4 bg-white/95 backdrop-blur rounded-[2rem]">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Timezone overlap</h3>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: "any" as const, label: "Any" },
            { id: "eu" as const, label: "EU-friendly" },
            { id: "us" as const, label: "US-friendly" },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => setTimezone(opt.id)}
              className={`rounded-2xl px-3 py-3 text-[10px] font-black uppercase tracking-widest border transition-colors ${
                timezone === opt.id ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-200 hover:text-indigo-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm">
        <div className="sticky top-0 z-10 -mx-2 px-2 pt-2 pb-4 bg-white/95 backdrop-blur rounded-[2rem]">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Seniority</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: "any" as const, label: "Any" },
            { id: "junior" as const, label: "Junior" },
            { id: "mid" as const, label: "Mid" },
            { id: "senior" as const, label: "Senior" },
            { id: "lead" as const, label: "Lead+" },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => setSeniority(opt.id)}
              className={`rounded-2xl px-3 py-3 text-[10px] font-black uppercase tracking-widest border transition-colors ${
                seniority === opt.id ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-200 hover:text-indigo-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm">
        <div className="sticky top-0 z-10 -mx-2 px-2 pt-2 pb-4 bg-white/95 backdrop-blur rounded-[2rem]">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Trust</h3>
        </div>
        <button
          onClick={() => setVerifiedOnly((prev) => !prev)}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
            verifiedOnly ? "bg-emerald-600 text-white shadow-xl shadow-emerald-100" : "text-gray-500 hover:bg-gray-50"
          }`}
          aria-pressed={verifiedOnly}
        >
          <span>Verified only</span>
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${verifiedOnly ? "bg-white/20 text-white" : "bg-gray-100 text-gray-400"}`}>
            {jobs.filter((j) => j.companyVerified).length}
          </span>
        </button>
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
        <div className="lg:sticky lg:top-20 z-40">
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
                    <option value="relevant">Most relevant</option>
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
                  variant="board"
                  selected={selected}
                  expanded={!isDesktop && expandedJobId === job.id}
                  isSaved={Boolean(isSaved)}
                  showSave={Boolean(canUseSaved)}
                  showMenu={true}
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
                    setExpandedJobId((prev) => (prev === job.id ? null : job.id));
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
