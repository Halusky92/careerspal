"use client";


import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Job, UserSession } from '../types';
import { createCompanySlug } from '../lib/jobs';
import { CATEGORY_HUBS, getCategoryHub, jobMatchesHub, resolveCategoryParam } from '../lib/categories';
import { isOnNicheJob } from '../lib/nicheScope';
import { useSupabaseAuth } from "./Providers";
import { authFetch } from "../lib/authFetch";
import JobRow from "./JobRow";
import JobDetailPanel from "./JobDetailPanel";
import PredictiveField from "./PredictiveField";
import { trackJobApply } from "../lib/trackJobEvent";
import FeaturedBoardZone from "./FeaturedBoardZone";
import { isPaidFeaturedListing, sortFeaturedJobs } from "../lib/featuredListing";

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
  const goCompany = (companyName: string) => {
    const href = `/companies/${createCompanySlug({ name: companyName })}`;
    if (typeof window !== "undefined" && window.location.hostname === "careerspal.com") {
      window.location.assign(`https://www.careerspal.com${href}`);
      return;
    }
    router.push(href);
  };
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
  const [urlUpdateTick, setUrlUpdateTick] = useState(0);
  const initialJobIdRef = useRef<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const suppressUrlUpdateRef = useRef(false);
  const pendingUrlUpdateRef = useRef(false);
  const titleRef = useRef<HTMLDivElement>(null);
  const locationRef = useRef<HTMLDivElement>(null);
  const filterScrollRef = useRef<HTMLDivElement>(null);
  const [showFilterTopShadow, setShowFilterTopShadow] = useState(false);
  const [showFilterBottomShadow, setShowFilterBottomShadow] = useState(false);
  const hydratedRef = useRef(false);
  
  // Pagination State
  const [visibleCount, setVisibleCount] = useState(JOBS_PER_PAGE);
  const [featuredOpen, setFeaturedOpen] = useState(false);

  const workModes: Array<'All' | 'Remote' | 'Hybrid' | 'Onsite'> = ['All', 'Remote', 'Hybrid', 'Onsite'];
  const employmentTypes: Array<'All' | Job['type']> = ['All', 'Full-time', 'Contract', 'Part-time', 'Freelance', 'Internship', 'Temporary'];
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
    const urlJobId = params.get("jobId");

    if (typeof urlQuery === "string" && urlQuery !== query) setQuery(urlQuery);
    if (typeof urlLocation === "string" && urlLocation !== locationQuery) setLocationQuery(urlLocation);
    if (urlCategory) setCategory(resolveCategoryParam(urlCategory));
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
    if (urlJobId && urlJobId.trim()) initialJobIdRef.current = urlJobId.trim();

    hydratedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hydratedRef.current) return;
    if (suppressUrlUpdateRef.current) {
      pendingUrlUpdateRef.current = true;
      return;
    }
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
      const activeJobId = (isDesktop ? selectedJobId : expandedJobId) || null;
      setOrDelete("jobId", activeJobId);
      const qs = params.toString();
      const nextUrl = qs ? `/jobs?${qs}` : "/jobs";
      // Avoid Next.js navigation on every keystroke (it can steal focus from inputs).
      // Still keeps a shareable URL for the current filter state.
      try {
        window.history.replaceState(null, "", nextUrl);
      } catch {
        router.replace(nextUrl, { scroll: false });
      }
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
    selectedJobId,
    expandedJobId,
    isDesktop,
    urlUpdateTick,
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

  // If we deep-link into /jobs?jobId=... on mobile first (before isDesktop is known),
  // make sure the desktop panel also opens once isDesktop flips to true.
  useEffect(() => {
    if (isDesktop) {
      if (!selectedJobId && expandedJobId) setSelectedJobId(expandedJobId);
      return;
    }
    if (!expandedJobId && selectedJobId) setExpandedJobId(selectedJobId);
  }, [expandedJobId, isDesktop, selectedJobId]);

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
    CATEGORY_HUBS.forEach((hub) => {
      counts[hub.slug] = jobs.filter((j) => jobMatchesHub(j, hub)).length;
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
      if (!isOnNicheJob(j)) return false;
      const matchesQuery = j.title.toLowerCase().includes(query.toLowerCase()) || 
                          j.company.toLowerCase().includes(query.toLowerCase()) ||
                          j.tags.some(t => t.toLowerCase().includes(query.toLowerCase()));
      const matchesLocation =
        !locationQuery.trim() || j.location.toLowerCase().includes(locationQuery.toLowerCase());
      const hub = category === "All Roles" ? null : getCategoryHub(category);
      const matchesCat = !hub || jobMatchesHub(j, hub);
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

    result = result.sort((a, b) => {
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

  const FEATURED_ZONE_CAP = 4;
  const featuredJobs = useMemo(
    () => sortFeaturedJobs(filteredAndSorted.filter(isPaidFeaturedListing)),
    [filteredAndSorted],
  );
  const boardJobs = useMemo(
    () => filteredAndSorted.filter((job) => !isPaidFeaturedListing(job)),
    [filteredAndSorted],
  );
  const visibleFeatured = featuredOpen ? featuredJobs : featuredJobs.slice(0, FEATURED_ZONE_CAP);

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
    trackJobApply(job.id);
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
        await authFetch(
          "/api/subscribers",
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ preference: query.trim() || "All" }),
          },
          accessToken,
        );
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
      if (category !== 'All Roles') chips.push({ label: getCategoryHub(category)?.label || category, onClear: () => setCategory('All Roles') });
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

  const scrollToJob = (jobId: string) => {
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      const el = rowRefs.current[jobId];
      if (el && typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    });
  };

  useEffect(() => {
    const initial = initialJobIdRef.current;
    if (!initial) return;
    const exists = filteredAndSorted.some((j) => j.id === initial);
    if (!exists) return;

    const idx = boardJobs.findIndex((j) => j.id === initial);
    if (idx >= 0 && idx + 1 > visibleCount) {
      setVisibleCount(Math.min(boardJobs.length, idx + 1));
    }
    if (featuredJobs.some((j) => j.id === initial) && featuredJobs.length > FEATURED_ZONE_CAP) {
      setFeaturedOpen(true);
    }

    // Deep link should behave like a real click:
    // - highlight the card (selected)
    // - open the right panel on desktop
    // - open the accordion on mobile
    // We set both; rendering decides which one is visible.
    setSelectedJobId(initial);
    setExpandedJobId(initial);

    window.setTimeout(() => scrollToJob(initial), 0);
    initialJobIdRef.current = null;
  }, [filteredAndSorted, boardJobs, featuredJobs, isDesktop, visibleCount]);

  const handleSelectJobId = (jobId: string) => {
    if (!jobId) return;
    const idx = boardJobs.findIndex((j) => j.id === jobId);
    if (idx >= 0 && idx + 1 > visibleCount) {
      setVisibleCount(Math.min(boardJobs.length, idx + 1));
    }
    if (featuredJobs.some((j) => j.id === jobId) && featuredJobs.length > FEATURED_ZONE_CAP) {
      setFeaturedOpen(true);
    }
    if (isDesktop) setSelectedJobId(jobId);
    else setExpandedJobId(jobId);
    window.setTimeout(() => scrollToJob(jobId), 0);
  };

  useEffect(() => {
    if (!isDesktop) return;
    if (initialJobIdRef.current) return;
    if (filteredAndSorted.length === 0) {
      setSelectedJobId(null);
      return;
    }
    const fallbackId = featuredJobs[0]?.id || boardJobs[0]?.id;
    if (!selectedJobId) {
      if (fallbackId) setSelectedJobId(fallbackId);
      return;
    }
    const stillVisible = filteredAndSorted.some((j) => j.id === selectedJobId);
    if (!stillVisible && fallbackId) {
      setSelectedJobId(fallbackId);
    }
  }, [filteredAndSorted, featuredJobs, boardJobs, isDesktop, selectedJobId]);

  const selectedJob = useMemo(
    () => filteredAndSorted.find((j) => j.id === selectedJobId) || null,
    [filteredAndSorted, selectedJobId],
  );

  const flushUrlUpdate = () => {
    if (typeof window === "undefined") return;
    if (!pendingUrlUpdateRef.current) return;
    pendingUrlUpdateRef.current = false;
    setUrlUpdateTick((x) => x + 1);
  };

  const preserveFilterPosition = (apply: () => void) => {
    if (typeof window === "undefined") {
      apply();
      return;
    }
    const pageY = window.scrollY;
    const filterY = filterScrollRef.current?.scrollTop ?? null;
    apply();
    window.requestAnimationFrame(() => {
      if (filterY !== null && filterScrollRef.current) {
        filterScrollRef.current.scrollTop = filterY;
      }
      // Extra safety: keep page position stable as well.
      window.scrollTo({ top: pageY, left: 0, behavior: "instant" as ScrollBehavior });
    });
  };

  type OpenWwrDropdown = null | "category" | "salary" | "skills";
  const [openWwrDropdown, setOpenWwrDropdown] = useState<OpenWwrDropdown>(null);
  const [wwrCategoryQuery, setWwrCategoryQuery] = useState("");
  const [wwrSkillQuery, setWwrSkillQuery] = useState("");

  const categoryOptions = CATEGORY_HUBS.map((hub) => hub.slug);

  const SALARY_RANGE_OPTIONS = useMemo(
    () =>
      [
        { label: "Any salary", min: 0, max: 0 },
        { label: "$10,000 – $25,000 USD", min: 10000, max: 25000 },
        { label: "$25,000 – $49,999 USD", min: 25000, max: 49999 },
        { label: "$50,000 – $74,999 USD", min: 50000, max: 74999 },
        { label: "$75,000 – $99,999 USD", min: 75000, max: 99999 },
        { label: "$100,000 – $149,999 USD", min: 100000, max: 149999 },
        { label: "$150,000+ USD", min: 150000, max: 0 },
      ] as const,
    [],
  );

  const selectedSalaryLabel = useMemo(() => {
    if (!salaryMin && !salaryMax) return "";
    const hit = SALARY_RANGE_OPTIONS.find((o) => o.min === salaryMin && o.max === (salaryMax || 0));
    if (hit) return hit.label;
    if (salaryMax > 0) return `${formatSalaryFloor(salaryMin)} – ${formatSalaryFloor(salaryMax)}`;
    return `From ${formatSalaryFloor(salaryMin)}`;
  }, [SALARY_RANGE_OPTIONS, salaryMin, salaryMax]);

  const skillsSummary = useMemo(() => {
    if (selectedTools.length === 0) return "";
    if (selectedTools.length === 1) return selectedTools[0];
    return `${selectedTools[0]} +${selectedTools.length - 1}`;
  }, [selectedTools]);

  const FilterContent = ({ variant }: { variant: "sidebar" | "sheet" }) => (
    <div
      className={[
        variant === "sidebar" ? "sticky top-16" : "",
        "rounded-2xl border border-slate-200 bg-white shadow-sm",
      ].join(" ")}
    >
      <div ref={filterScrollRef} className={["p-4", variant === "sheet" ? "max-h-[70vh] overflow-y-auto" : ""].join(" ")}>
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm font-semibold text-slate-900">Search jobs</div>
          <button
            type="button"
            onClick={() =>
              preserveFilterPosition(() => {
                clearAllFilters();
                setOpenWwrDropdown(null);
              })
            }
            className="text-xs font-medium text-slate-500 hover:text-slate-900"
          >
            Clear
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {/* Search */}
          <div>
            <div className="text-[11px] font-medium text-slate-700 flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search
            </div>
            <input
              value={query}
              onChange={(e) => preserveFilterPosition(() => setQuery(e.target.value))}
              placeholder="Search everything..."
              className="cp-field mt-2 w-full h-10 rounded-xl px-3 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>

          {/* Job Categories */}
          <div className="relative">
            <div className="text-[11px] font-medium text-slate-700 flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h10" />
              </svg>
              Job Categories
            </div>
            <button
              type="button"
              onClick={() => setOpenWwrDropdown((prev) => (prev === "category" ? null : "category"))}
              className="cp-field mt-2 w-full h-10 rounded-xl bg-white px-3 text-left text-sm font-medium text-slate-900"
            >
              <span className={category !== "All Roles" ? "" : "text-slate-400"}>
                {category !== "All Roles" ? getCategoryHub(category)?.label || category : "Search job category..."}
              </span>
            </button>
            {openWwrDropdown === "category" && (
              <div className="mt-2 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                <div className="p-2 border-b border-slate-100">
                  <input
                    value={wwrCategoryQuery}
                    onChange={(e) => setWwrCategoryQuery(e.target.value)}
                    placeholder="Search job category..."
                    className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-900 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 placeholder:text-slate-400"
                    autoFocus
                  />
                </div>
                <div className="max-h-56 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() =>
                      preserveFilterPosition(() => {
                        setCategory("All Roles");
                        setOpenWwrDropdown(null);
                        setWwrCategoryQuery("");
                      })
                    }
                    className="w-full text-left px-3 py-2 text-sm font-medium hover:bg-slate-50"
                  >
                    All categories
                  </button>
                  {categoryOptions
                    .filter((c) => c.toLowerCase().includes(wwrCategoryQuery.trim().toLowerCase()))
                    .map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() =>
                          preserveFilterPosition(() => {
                            setCategory(c);
                            setOpenWwrDropdown(null);
                            setWwrCategoryQuery("");
                            if (window.innerWidth < 1024) setIsFilterOpen(false);
                          })
                        }
                        className={[
                          "w-full text-left px-3 py-2 text-sm font-medium hover:bg-slate-50",
                          category === c ? "bg-indigo-50 text-indigo-700" : "text-slate-900",
                        ].join(" ")}
                      >
                        {getCategoryHub(c)?.label || c}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Countries */}
          <div>
            <div className="text-[11px] font-medium text-slate-700 flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21s7-4.35 7-11a7 7 0 10-14 0c0 6.65 7 11 7 11z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
              Countries
            </div>
            <input
              value={locationQuery}
              onChange={(e) => preserveFilterPosition(() => setLocationQuery(e.target.value))}
              placeholder="Search country..."
              className="cp-field mt-2 w-full h-10 rounded-xl px-3 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>

          {/* Salary range */}
          <div className="relative">
            <div className="text-[11px] font-medium text-slate-700 flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-3 0-5 1.343-5 3s2 3 5 3 5 1.343 5 3-2 3-5 3m0-15v2m0 12v2" />
              </svg>
              Salary Range
            </div>
            <button
              type="button"
              onClick={() => setOpenWwrDropdown((prev) => (prev === "salary" ? null : "salary"))}
              className="cp-field mt-2 w-full h-10 rounded-xl bg-white px-3 text-left text-sm font-medium text-slate-900"
            >
              <span className={selectedSalaryLabel ? "" : "text-slate-400"}>
                {selectedSalaryLabel || "Search by salary range..."}
              </span>
            </button>
            {openWwrDropdown === "salary" && (
              <div className="mt-2 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                <div className="max-h-56 overflow-y-auto py-1">
                  {SALARY_RANGE_OPTIONS.map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() =>
                        preserveFilterPosition(() => {
                          setSalaryMin(opt.min);
                          setSalaryMax(opt.max === 0 ? 0 : opt.max);
                          setOpenWwrDropdown(null);
                          if (window.innerWidth < 1024) setIsFilterOpen(false);
                        })
                      }
                      className="w-full text-left px-3 py-2 text-sm font-medium hover:bg-slate-50 text-slate-900"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Skills */}
          <div className="relative">
            <div className="text-[11px] font-medium text-slate-700 flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-7 4h8m2 5H6a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v14a2 2 0 01-2 2z" />
              </svg>
              Skills
            </div>
            <button
              type="button"
              onClick={() => setOpenWwrDropdown((prev) => (prev === "skills" ? null : "skills"))}
              className="cp-field mt-2 w-full h-10 rounded-xl bg-white px-3 text-left text-sm font-medium text-slate-900"
            >
              <span className={skillsSummary ? "" : "text-slate-400"}>
                {skillsSummary || "Search skills..."}
              </span>
            </button>
            {openWwrDropdown === "skills" && (
              <div className="mt-2 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                <div className="p-2 border-b border-slate-100">
                  <input
                    value={wwrSkillQuery}
                    onChange={(e) => setWwrSkillQuery(e.target.value)}
                    placeholder="Search skills..."
                    className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-900 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 placeholder:text-slate-400"
                    autoFocus
                  />
                </div>
                <div className="max-h-56 overflow-y-auto py-1">
                  {TOOL_OPTIONS.filter((t) => t.toLowerCase().includes(wwrSkillQuery.trim().toLowerCase())).map((tool) => {
                    const active = selectedTools.includes(tool);
                    return (
                      <button
                        key={tool}
                        type="button"
                        onClick={() =>
                          preserveFilterPosition(() => {
                            setSelectedTools((prev) =>
                              prev.includes(tool) ? prev.filter((x) => x !== tool) : [...prev, tool],
                            );
                          })
                        }
                        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-slate-50"
                      >
                        <span className="text-slate-900">{tool}</span>
                        <span
                          className={[
                            "h-5 w-5 rounded border flex items-center justify-center text-xs",
                            active ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-200 text-transparent",
                          ].join(" ")}
                          aria-hidden="true"
                        >
                          ✓
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setOpenWwrDropdown(null);
              if (variant === "sheet") setIsFilterOpen(false);
            }}
            className="mt-2 w-full h-9 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-black"
          >
            Apply filters
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-[#F8F9FD]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-3">
        <div>
          <div className="cp-search rounded-xl px-3 sm:px-4 py-2">
            <div className="flex flex-col lg:flex-row lg:items-end gap-2 lg:gap-3">
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                <div ref={titleRef} className="relative">
                  <label className="text-[10px] font-medium text-slate-500">
                    Search
                  </label>
                  <div className="relative mt-1">
                    <PredictiveField
                      value={query}
                      onChange={setQuery}
                      placeholder="Role, company, tool…"
                      ariaLabel="Role, company, tool…"
                      inputClassName="cp-field w-full h-10 rounded-lg px-3 pr-9 text-[16px] sm:text-sm text-slate-900 outline-none bg-white"
                    />
                    {query && (
                      <button
                        type="button"
                        onClick={() => setQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900"
                        aria-label="Clear search"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                <div ref={locationRef} className="relative">
                  <label className="text-[10px] font-medium text-slate-500">
                    Location
                  </label>
                  <div className="relative mt-1">
                    <PredictiveField
                      kind="location"
                      value={locationQuery}
                      onChange={setLocationQuery}
                      placeholder="City, country, or remote"
                      ariaLabel="City, country, or remote"
                      inputClassName="cp-field w-full h-10 rounded-lg px-3 pr-9 text-[16px] sm:text-sm text-slate-900 outline-none bg-white"
                    />
                    {locationQuery && (
                      <button
                        type="button"
                        onClick={() => setLocationQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900"
                        aria-label="Clear location"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                <div className="hidden lg:block lg:col-start-3">
                  <label className="text-[10px] font-medium text-slate-500">
                    Sort
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="cp-field mt-1 w-full h-10 rounded-lg bg-white px-3 text-sm text-slate-800 outline-none"
                  >
                    <option value="newest">Newest</option>
                    <option value="salary">Highest salary</option>
                    <option value="relevant">Most relevant</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between lg:justify-end gap-3">
                <div className="flex items-center gap-2 w-full lg:w-auto">
                  {canUseSaved && (
                    <button
                      onClick={() => setShowSavedOnly((prev) => !prev)}
                      disabled={savedCount === 0}
                      aria-pressed={showSavedOnly}
                      className={`hidden lg:inline-flex h-10 px-3 rounded-lg border text-sm font-medium transition-colors ${
                        showSavedOnly
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-slate-600 border-slate-300 hover:border-indigo-200 hover:text-indigo-700"
                      } ${savedCount === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      {showSavedOnly ? "Saved" : `Saved (${savedCount})`}
                    </button>
                  )}
                  <button
                    onClick={clearAllFilters}
                    className="hidden lg:inline-flex h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-600 hover:border-indigo-200 hover:text-indigo-700"
                  >
                    Reset
                  </button>
                  <button
                    onClick={() => setIsFilterOpen(true)}
                    className="lg:hidden h-10 flex-1 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-black"
                  >
                    Filters
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[11px] font-medium text-slate-500" aria-live="polite">
                  {filteredAndSorted.length} roles
                </span>
                {(query.trim() || locationQuery.trim()) && (
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                    Showing {query.trim() || "all roles"}{locationQuery.trim() ? ` in ${locationQuery.trim()}` : ""}
                  </span>
                )}
              </div>
              <div className="hidden sm:flex items-center gap-3">
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
            {FilterContent({ variant: "sidebar" })}
          </aside>

          <div className="lg:col-span-5 space-y-3">
            <FeaturedBoardZone count={featuredJobs.length}>
                {visibleFeatured.map((job) => {
                  const isSaved = user?.savedJobIds?.includes(job.id);
                  const selected = isDesktop && selectedJobId === job.id;
                  return (
                    <div
                      key={job.id}
                      ref={(el) => {
                        rowRefs.current[job.id] = el;
                      }}
                      data-job-id={job.id}
                    >
                      <JobRow
                        job={job}
                        variant="board"
                        selected={selected}
                        expanded={!isDesktop && expandedJobId === job.id}
                        isSaved={Boolean(isSaved)}
                        showSave={Boolean(canUseSaved)}
                        showMenu={true}
                        onToggleSave={() => onToggleBookmark(job.id)}
                        onSelect={() => {
                          if (isDesktop) {
                            handleSelectJobId(job.id);
                            return;
                          }
                          setExpandedJobId((prev) => (prev === job.id ? null : job.id));
                        }}
                        onApply={() => handleApply(job)}
                      />
                    </div>
                  );
                })}
                {featuredJobs.length > FEATURED_ZONE_CAP && (
                  <button
                    type="button"
                    onClick={() => setFeaturedOpen((open) => !open)}
                    className="w-full h-9 rounded-lg bg-white border border-indigo-200 text-indigo-800 text-sm font-medium hover:bg-indigo-50"
                  >
                    {featuredOpen
                      ? "Show fewer featured"
                      : `Show all featured (${featuredJobs.length})`}
                  </button>
                )}
              </FeaturedBoardZone>

            {featuredJobs.length > 0 && boardJobs.length > 0 && (
              <p className="pt-1 px-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">All roles</p>
            )}

            {boardJobs.slice(0, visibleCount).map((job) => {
              const isSaved = user?.savedJobIds?.includes(job.id);
              const selected = isDesktop && selectedJobId === job.id;

              return (
                <div
                  key={job.id}
                  ref={(el) => {
                    rowRefs.current[job.id] = el;
                  }}
                  data-job-id={job.id}
                >
                  <JobRow
                    job={job}
                    variant="board"
                    selected={selected}
                    expanded={!isDesktop && expandedJobId === job.id}
                    isSaved={Boolean(isSaved)}
                    showSave={Boolean(canUseSaved)}
                    showMenu={true}
                    onToggleSave={() => onToggleBookmark(job.id)}
                    onSelect={() => {
                      if (isDesktop) {
                        handleSelectJobId(job.id);
                        return;
                      }
                      setExpandedJobId((prev) => (prev === job.id ? null : job.id));
                    }}
                    onApply={() => handleApply(job)}
                  />
                </div>
              );
            })}

            {boardJobs.length > visibleCount && (
              <div className="pt-4 pb-2 text-center">
                <button
                  onClick={handleLoadMore}
                  className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:border-indigo-200 hover:text-indigo-700"
                >
                  Show more ({boardJobs.length - visibleCount} remaining)
                </button>
              </div>
            )}

            {filteredAndSorted.length === 0 && (
              <div className="bg-white py-8 rounded-xl text-center border border-dashed border-slate-200">
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
              onSelectJobId={handleSelectJobId}
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
              {FilterContent({ variant: "sheet" })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FindJobs;
