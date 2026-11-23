"use client";


import React, { startTransition, useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
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
import { startApply } from "../lib/startApply";
import { inferWorkMode } from "../lib/workMode";
import FeaturedBoardZone from "./FeaturedBoardZone";
import { isPaidFeaturedListing, sortFeaturedJobs } from "../lib/featuredListing";
import { isPriorityListing } from "../lib/listingWindow";
import SalaryRangeSlider from "./SalaryRangeSlider";
import { jobMatchesLocationQuery, locationLabelsForJobs, workModeFromPlaceLabel } from "../lib/locationFilter";
import { KNOWN_TOOL_LABELS } from "../lib/postingTools";
import { boardAccessHeadline, boardCap, boardHiddenNote, boardHiddenSentences, type LockedBoardPreview } from "../lib/boardAccess";
import { JOBS_RETURN_KEY, jobIdToRestore, readJobsReturnPlace, type JobsReturnPlace } from "../lib/jobsReturn";
import { trackFunnel, trackFunnelOnce } from "../lib/funnelTrack";

interface FindJobsProps {
  jobs: Job[];
  onSelectJob?: (job: Job) => void;
  onSelectCompany?: (companyName: string) => void;
  initialQuery?: string;
  initialLocationQuery?: string;
  user?: UserSession | null;
  boardAccess?: "guest" | "registered" | "paid";
  boardTotal?: number | null;
  lockedJobs?: LockedBoardPreview[];
  companyCount?: number;
  categoryTotals?: Record<string, number>;
  canLoadMore?: boolean;
  onLoadMore?: () => void;
  onToggleBookmark: (jobId: string) => void;
}

const JOBS_PER_PAGE = 7;

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

const jobHasSelectedTools = (job: Job, tools: string[]) => {
  if (tools.length === 0) return true;
  const tokens = getToolSignals(job);
  return tools.every((tool) => {
    const key = tool.toLowerCase();
    if (key === "make") return tokens.has("make") || tokens.has("make.com");
    if (key === "google sheets") return tokens.has("google sheets") || tokens.has("sheets");
    return tokens.has(key);
  });
};

const canonicalTool = (label: string) => {
  const key = label.trim().toLowerCase();
  return KNOWN_TOOL_LABELS.find((tool) => tool.toLowerCase() === key) || label.trim();
};

const FindJobs: React.FC<FindJobsProps> = ({
  jobs,
  onSelectJob,
  onSelectCompany,
  initialQuery = '',
  initialLocationQuery = '',
  user,
  boardAccess,
  boardTotal,
  lockedJobs = [],
  companyCount = 0,
  categoryTotals,
  canLoadMore = false,
  onLoadMore,
  onToggleBookmark,
}) => {
  const router = useRouter();
  const { accessToken } = useSupabaseAuth();
  const advancedOk = true;
  const searchCap = boardAccess ? boardCap(boardAccess) : null;
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
  const [workMode, setWorkMode] = useState<'All' | 'Remote' | 'Hybrid'>('All');
  const [employmentType, setEmploymentType] = useState<'All' | Job['type']>('All');
  const [sortBy, setSortBy] = useState<SortOption>("relevant");
  const [salaryMin, setSalaryMin] = useState(0);
  const [salaryMax, setSalaryMax] = useState(0);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [timezone, setTimezone] = useState<TzOption>("any");
  const [seniority, setSeniority] = useState<SeniorityOption>("any");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterFrame, setFilterFrame] = useState<{ top: number; height: number } | null>(null);
  const [showMobileFilterBar, setShowMobileFilterBar] = useState(false);
  const [openWwrDropdown, setOpenWwrDropdown] = useState<null | "category" | "salary" | "skills" | "country" | "work">(null);
  const [wwrSkillQuery, setWwrSkillQuery] = useState("");
  const [wwrLocationQuery, setWwrLocationQuery] = useState("");
  const [showTitleSuggestions, setShowTitleSuggestions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [urlUpdateTick, setUrlUpdateTick] = useState(0);
  const initialJobIdRef = useRef<string | null>(null);
  const restoredJobIdRef = useRef<string | null>(null);
  const returnPlaceRef = useRef<JobsReturnPlace | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const suppressUrlUpdateRef = useRef(false);
  const pendingUrlUpdateRef = useRef(false);
  const titleRef = useRef<HTMLDivElement>(null);
  const filterScrollRef = useRef<HTMLDivElement>(null);
  const loadSentinelRef = useRef<HTMLDivElement>(null);
  const [showFilterTopShadow, setShowFilterTopShadow] = useState(false);
  const [showFilterBottomShadow, setShowFilterBottomShadow] = useState(false);
  const hydratedRef = useRef(false);
  
  // Pagination State
  const [visibleCount, setVisibleCount] = useState(JOBS_PER_PAGE);
  const [featuredOpen, setFeaturedOpen] = useState(false);

  useEffect(() => {
    if (!isFilterOpen || typeof window === "undefined") return;
    const openedHeight = window.visualViewport?.height ?? window.innerHeight;
    const fit = () => {
      const viewport = window.visualViewport;
      const height = viewport?.height ?? window.innerHeight;
      // The keyboard shrinks the visible area. Following that crush makes the whole dialog jump.
      if (height < openedHeight - 80) return;
      setFilterFrame({
        top: viewport?.offsetTop ?? 0,
        height,
      });
    };
    const y = window.scrollY;
    const body = document.body;
    body.style.position = "fixed";
    body.style.top = `-${y}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    fit();
    window.visualViewport?.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("scroll", fit);
    return () => {
      window.visualViewport?.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("scroll", fit);
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      body.style.width = "";
      setFilterFrame(null);
      window.scrollTo(0, y);
    };
  }, [isFilterOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () => {
      const phone = window.matchMedia("(max-width: 1023px)").matches;
      setShowMobileFilterBar(phone && window.scrollY > 240 && !isFilterOpen);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [isFilterOpen]);

  const workModes: Array<'All' | 'Remote' | 'Hybrid'> = ['All', 'Remote', 'Hybrid'];
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
    const moved = workModeFromPlaceLabel(initialLocationQuery);
    if (moved === "Remote" || moved === "Hybrid") setWorkMode(moved);
    if (moved) {
      setLocationQuery("");
      return;
    }
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
    const movedPlace = typeof urlLocation === "string" ? workModeFromPlaceLabel(urlLocation) : null;
    if (movedPlace) {
      setLocationQuery("");
      if (!urlWorkMode && (movedPlace === "Remote" || movedPlace === "Hybrid")) setWorkMode(movedPlace);
    } else if (typeof urlLocation === "string" && urlLocation !== locationQuery) {
      setLocationQuery(urlLocation);
    }
    if (urlCategory) setCategory(resolveCategoryParam(urlCategory));
    if (urlWorkMode && workModes.includes(urlWorkMode as any)) setWorkMode(urlWorkMode as any);
    if (urlType && employmentTypes.includes(urlType as any)) setEmploymentType(urlType as any);
    if (urlSort && (urlSort === "newest" || urlSort === "salary" || urlSort === "relevant")) setSortBy(urlSort);
    setSalaryMin(Math.max(0, parseNumberParam(urlSalaryMin, 0)));
    setSalaryMax(Math.max(0, parseNumberParam(urlSalaryMax, 0)));
    setSelectedTools(parseCsvParam(urlTools).slice(0, 8));
    if (urlTz && (urlTz === "any" || urlTz === "eu" || urlTz === "us")) setTimezone(urlTz);
    if (urlSeniority && SENIORITY_OPTIONS.includes(urlSeniority as any)) setSeniority(urlSeniority as any);
    setVerifiedOnly(urlVerified === "1");
    setShowSavedOnly(urlSaved === "1");
    let storedReturn: string | null = null;
    try {
      storedReturn = window.sessionStorage.getItem(JOBS_RETURN_KEY);
    } catch {
      storedReturn = null;
    }
    const place = readJobsReturnPlace(storedReturn);
    if (place) returnPlaceRef.current = place;
    const restoreId = jobIdToRestore(urlJobId, storedReturn);
    if (restoreId) initialJobIdRef.current = restoreId;
    if (place && place.visibleCount > JOBS_PER_PAGE) setVisibleCount(place.visibleCount);

    hydratedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.sessionStorage.getItem(JOBS_RETURN_KEY);
    } catch {
      stored = null;
    }
    const place = readJobsReturnPlace(stored);
    const params = new URLSearchParams(window.location.search);
    const restoreId = jobIdToRestore(params.get("jobId"), stored);
    if (restoreId) initialJobIdRef.current = restoreId;
    if (!place) return;
    returnPlaceRef.current = place;
    if (place.visibleCount > JOBS_PER_PAGE) {
      setVisibleCount((current) => Math.max(current, place.visibleCount));
    }
  }, []);

  useLayoutEffect(() => {
    const place = returnPlaceRef.current;
    if (!place || place.scrollY <= 0) return;
    if (place.visibleCount > visibleCount) return;
    const jobId = initialJobIdRef.current || place.jobId;
    if (jobId && jobs.some((job) => job.id === jobId) && !rowRefs.current[jobId]) return;
    if (place.scrollY > window.innerHeight && document.documentElement.scrollHeight < place.scrollY + 200) return;
    const top = place.scrollY;
    window.scrollTo({ top, left: 0, behavior: "instant" });
    const timer = window.setTimeout(() => window.scrollTo({ top, left: 0, behavior: "instant" }), 60);
    returnPlaceRef.current = null;
    try {
      window.sessionStorage.removeItem(JOBS_RETURN_KEY);
    } catch {
      // the address still has the job id
    }
    return () => window.clearTimeout(timer);
  }, [jobs, visibleCount]);

  useEffect(() => {
    const reset = () => {
      window.scrollTo({ left: 0, top: window.scrollY });
      document.documentElement.scrollLeft = 0;
    };
    reset();
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
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
      setOrDelete("sort", sortBy !== "relevant" ? sortBy : null);
      setOrDelete("salaryMin", salaryMin > 0 ? String(salaryMin) : null);
      setOrDelete("salaryMax", salaryMax > 0 ? String(salaryMax) : null);
      setOrDelete("tools", selectedTools.length > 0 ? selectedTools.join(",") : null);
      setOrDelete("tz", timezone !== "any" ? timezone : null);
      setOrDelete("seniority", seniority !== "any" ? seniority : null);
      setOrDelete("verified", verifiedOnly ? "1" : null);
      setOrDelete("saved", showSavedOnly ? "1" : null);
      const activeJobId = (isDesktop ? selectedJobId : expandedJobId) || initialJobIdRef.current;
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

  const filtersNarrow =
    category !== "All Roles" ||
    query.trim() !== "" ||
    locationQuery.trim() !== "" ||
    workMode !== "All" ||
    employmentType !== "All" ||
    salaryMin > 0 ||
    salaryMax > 0 ||
    selectedTools.length > 0 ||
    timezone !== "any" ||
    seniority !== "any" ||
    verifiedOnly ||
    showSavedOnly;

  // A filter shows every match. An unfiltered board grows as the reader moves down.
  useEffect(() => {
    if (returnPlaceRef.current || initialJobIdRef.current || restoredJobIdRef.current) return;
    setExpandedJobId(null);
    if (!filtersNarrow) setVisibleCount(JOBS_PER_PAGE);
  }, [
    filtersNarrow,
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

  // Copy the open role across the desktop/mobile breakpoint only.
  // Doing it on every expanded change pinned a closed mobile card back open.
  const wasDesktopRef = useRef(isDesktop);
  useEffect(() => {
    if (wasDesktopRef.current === isDesktop) return;
    wasDesktopRef.current = isDesktop;
    if (isDesktop) {
      if (expandedJobId) setSelectedJobId(expandedJobId);
      return;
    }
    if (selectedJobId) setExpandedJobId(selectedJobId);
  }, [isDesktop, expandedJobId, selectedJobId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (titleRef.current && !titleRef.current.contains(target)) {
        setShowTitleSuggestions(false);
      }
      const el = target instanceof Element ? target.closest("[data-wwr-filter]") : null;
      if (!el) setOpenWwrDropdown(null);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenWwrDropdown(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
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
    if (/\b(?:sgd|hkd|inr|eur|gbp|cad|aud|nzd|chf|jpy|sek|nok|dkk|pln|czk)\b|€|£|ca\$|a\$/i.test(salary) && !/\busd\b|us\$/i.test(salary)) {
      return { min: 0, max: 0 };
    }
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
  const getWorkMode = (job: Job) => inferWorkMode(job);

  // Helper to determine salary competitiveness
  const getSalaryLevel = (salary: string) => {
    const val = getSalaryValue(salary);
    if (val > 140000) return { label: 'Top 5%', color: 'bg-emerald-500', width: '95%' };
    if (val > 110000) return { label: 'High', color: 'bg-indigo-500', width: '75%' };
    if (val > 80000) return { label: 'Market', color: 'bg-blue-400', width: '50%' };
    return { label: 'Entry', color: 'bg-slate-300', width: '30%' };
  };

  const loadedCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = { "All Roles": jobs.length };
    CATEGORY_HUBS.forEach((hub) => {
      counts[hub.slug] = jobs.filter((j) => jobMatchesHub(j, hub)).length;
    });
    return counts;
  }, [jobs]);
  const listComplete = typeof boardTotal !== "number" || jobs.length >= boardTotal;
  const categoryCounts = listComplete || !categoryTotals ? loadedCategoryCounts : categoryTotals;
  const lockedCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    CATEGORY_HUBS.forEach((hub) => {
      counts[hub.slug] = lockedJobs.filter((job) => jobMatchesHub(job, hub)).length;
    });
    return counts;
  }, [lockedJobs]);

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
      if (!isOnNicheJob(j)) return false;
      const q = query.trim().toLowerCase();
      const matchesQuery = !q ||
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        (j.tags || []).some((t) => t.toLowerCase().includes(q)) ||
        (j.tools || []).some((t) => t.toLowerCase().includes(q));
      const matchesLocation = jobMatchesLocationQuery(j, locationQuery);
      const hub = category === "All Roles" ? null : getCategoryHub(category);
      const matchesCat = !hub || jobMatchesHub(j, hub);
      const matchesWorkMode = workMode === 'All' || getWorkMode(j) === workMode;
      const matchesEmployment = employmentType === 'All' || j.type === employmentType;
      const salaryRange = parseSalaryRange(j.salary);
      const matchesSaved = !showSavedOnly || savedIds.has(j.id);
      const useSalaryMin = advancedOk ? salaryMin : 0;
      const useSalaryMax = advancedOk ? salaryMax : 0;
      const useTools = advancedOk ? selectedTools : [];
      const useTz = advancedOk ? timezone : "any";
      const useSeniority = advancedOk ? seniority : "any";
      const useVerified = advancedOk && verifiedOnly;
      const matchesSalaryMin = useSalaryMin === 0 || salaryRange.max >= useSalaryMin;
      const matchesSalaryMax = useSalaryMax === 0 || salaryRange.min <= useSalaryMax;
      const matchesTools = jobHasSelectedTools(j, useTools);
      const bucket = inferTimezoneBucket(j);
      const matchesTz = useTz === "any" ? true : bucket === useTz || bucket === "unknown";
      const inferredSeniority = inferSeniority(j);
      const matchesSeniority =
        useSeniority === "any" ? true : inferredSeniority === useSeniority || inferredSeniority === "unknown";
      const matchesVerified = !useVerified || Boolean(j.companyVerified);

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

      if (sortBy === "relevant") {
        const priority = Number(isPriorityListing(b)) - Number(isPriorityListing(a));
        if (priority !== 0) return priority;
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
        const scored = score(b) - score(a);
        if (scored !== 0) return scored;
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
    advancedOk,
  ]);

  const FEATURED_ZONE_CAP = 4;
  const listedJobs = useMemo(() => {
    if (searchCap == null) return filteredAndSorted;
    return filteredAndSorted.slice(0, searchCap);
  }, [filteredAndSorted, searchCap]);
  const featuredJobs = useMemo(
    () => sortFeaturedJobs(listedJobs.filter(isPaidFeaturedListing)),
    [listedJobs],
  );
  const boardJobs = useMemo(
    () => listedJobs.filter((job) => !isPaidFeaturedListing(job)),
    [listedJobs],
  );
  useEffect(() => {
    if (!filtersNarrow || isFilterOpen) return;
    if (returnPlaceRef.current || initialJobIdRef.current || restoredJobIdRef.current) return;
    setVisibleCount(Math.max(boardJobs.length, JOBS_PER_PAGE));
  }, [filtersNarrow, boardJobs.length, isFilterOpen]);
  const showSearchLimitCta =
    searchCap != null &&
    ((typeof boardTotal === "number" && boardTotal > searchCap) || filteredAndSorted.length > listedJobs.length) &&
    boardJobs.length <= visibleCount;
  const matchingLocked = useMemo(() => {
    if (searchCap == null) return [];
    const q = query.trim().toLowerCase();
    const hub = category !== "All Roles" ? getCategoryHub(category) : null;
    return lockedJobs.filter((job) => {
      if (q) {
        const hay = `${job.title} ${job.company} ${job.category}`.toLowerCase();
        if (!q.split(/\s+/).filter(Boolean).every((token) => hay.includes(token))) return false;
      }
      if (locationQuery.trim() && !jobMatchesLocationQuery(job, locationQuery)) return false;
      if (hub && !jobMatchesHub(job, hub)) return false;
      return true;
    });
  }, [lockedJobs, searchCap, query, locationQuery, category]);
  const lockedShown = matchingLocked.slice(0, 2);
  const lockedMore = matchingLocked.length - lockedShown.length;
  const hiddenNote = boardHiddenNote(boardAccess, boardTotal);
  const hiddenSentences = hiddenNote ? boardHiddenSentences(hiddenNote) : null;
  const accessHeadline = boardAccessHeadline(boardAccess, boardTotal, companyCount);
  useEffect(() => {
    if (!showSearchLimitCta) return;
    trackFunnelOnce("search_limit_reached", { access: boardAccess || "none", matching: filteredAndSorted.length });
  }, [showSearchLimitCta, boardAccess, filteredAndSorted.length]);
  const visibleFeatured = featuredOpen ? featuredJobs : featuredJobs.slice(0, FEATURED_ZONE_CAP);

  const suggestions = useMemo(() => {
    if (!query.trim() || query.length < 1) return [];
    const lowQuery = query.toLowerCase();
    
    const titles = jobs.filter(j => j.title.toLowerCase().includes(lowQuery)).map(j => j.title);
    const companies = jobs.filter(j => j.company.toLowerCase().includes(lowQuery)).map(j => j.company);
    const tags = jobs.flatMap(j => j.tags || []).filter(t => t.toLowerCase().includes(lowQuery));
    const tools = jobs.flatMap(j => j.tools || []).filter(t => t.toLowerCase().includes(lowQuery));
    
    return Array.from(new Set([...titles, ...companies, ...tags, ...tools])).slice(0, 5);
  }, [query, jobs]);

  const locationSuggestions = useMemo(() => {
    if (!locationQuery.trim() || locationQuery.length < 1) return [];
    const lowQuery = locationQuery.toLowerCase();
    return locationLabelsForJobs(jobs)
      .filter((label) => label.toLowerCase().includes(lowQuery))
      .slice(0, 6);
  }, [locationQuery, jobs]);

  const rememberPlace = (jobId: string) => {
    try {
      window.sessionStorage.setItem(
        JOBS_RETURN_KEY,
        JSON.stringify({
          jobId,
          scrollY: window.scrollY,
          visibleCount,
          loadedCount: jobs.length,
        }),
      );
    } catch {
      // the back link still carries the job id
    }
  };

  const handleLoadMore = () => {
    const next = visibleCount + JOBS_PER_PAGE;
    if (canLoadMore && next > boardJobs.length) onLoadMore?.();
    setVisibleCount(next);
  };

  useEffect(() => {
    const node = loadSentinelRef.current;
    if (!node || filtersNarrow) return;
    if (boardJobs.length <= visibleCount && !canLoadMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) handleLoadMore();
      },
      { rootMargin: "400px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [filtersNarrow, boardJobs.length, visibleCount, canLoadMore]);

  const handleApply = async (job: Job) => {
    const isPrivate = job.status === "private" || job.status === "invite_only";
    const result = startApply({
      accessToken,
      jobId: job.id,
      applyUrl: job.applyUrl,
      isPrivate,
    });
    if (result.missing) {
      alert("Apply link is not available yet.");
      return;
    }
    if (result.href) router.push(result.href);
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
      } else if (response.status === 403) {
        setSavedNotice('Free accounts can save one search. Upgrade for more.');
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
    setSortBy("relevant");
    setSalaryMin(0);
    setSalaryMax(0);
    setSelectedTools([]);
    setTimezone("any");
    setSeniority("any");
    setVerifiedOnly(false);
    setShowSavedOnly(false);
    setShowTitleSuggestions(false);
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

  const scrollToJob = (jobId: string, behavior: ScrollBehavior = "smooth") => {
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      const el = rowRefs.current[jobId];
      if (el && typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ block: "center", behavior });
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
      return;
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
    restoredJobIdRef.current = initial;

    window.setTimeout(() => scrollToJob(initial, "instant"), 0);
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
    else {
      setExpandedJobId(jobId);
      window.setTimeout(() => scrollToJob(jobId), 0);
    }
  };

  useEffect(() => {
    if (!isDesktop) return;
    if (initialJobIdRef.current || restoredJobIdRef.current) return;
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
    if (isFilterOpen) {
      startTransition(apply);
      return;
    }
    const pageY = window.scrollY;
    const filterY = filterScrollRef.current?.scrollTop ?? null;
    startTransition(apply);
    window.requestAnimationFrame(() => {
      if (filterY !== null && filterScrollRef.current) {
        filterScrollRef.current.scrollTop = filterY;
      }
      // Extra safety: keep page position stable as well.
      window.scrollTo({ top: pageY, left: 0, behavior: "instant" as ScrollBehavior });
    });
  };

  const facet = useMemo(() => {
    const match = (job: Job, skip: "category" | "location" | "work" | null) => {
      if (!isOnNicheJob(job)) return false;
      const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
      if (tokens.length > 0) {
        const hay = `${job.title} ${job.company} ${(job.tags || []).join(" ")} ${(job.tools || []).join(" ")}`.toLowerCase();
        if (!tokens.every((token) => hay.includes(token))) return false;
      }
      if (skip !== "location" && !jobMatchesLocationQuery(job, locationQuery)) return false;
      if (skip !== "category") {
        const hub = category === "All Roles" ? null : getCategoryHub(category);
        if (hub && !jobMatchesHub(job, hub)) return false;
      }
      if (skip !== "work" && workMode !== "All" && inferWorkMode(job) !== workMode) return false;
      if (employmentType !== "All" && job.type !== employmentType) return false;
      if (showSavedOnly && !savedIds.has(job.id)) return false;
      if (advancedOk && selectedTools.length > 0 && !jobHasSelectedTools(job, selectedTools)) return false;
      return true;
    };
    const categoryPool = jobs.filter((job) => match(job, "category"));
    const counts: Record<string, number> = { "All Roles": categoryPool.length };
    CATEGORY_HUBS.forEach((hub) => {
      counts[hub.slug] = categoryPool.filter((job) => jobMatchesHub(job, hub)).length;
    });
    const workPool = jobs.filter((job) => match(job, "work"));
    return {
      counts,
      locations: locationLabelsForJobs(jobs.filter((job) => match(job, "location"))),
      workCounts: {
        Remote: workPool.filter((job) => inferWorkMode(job) === "Remote").length,
        Hybrid: workPool.filter((job) => inferWorkMode(job) === "Hybrid").length,
      },
      toolJobs: jobs.filter((job) => match(job, null)),
    };
  }, [jobs, query, locationQuery, category, workMode, employmentType, showSavedOnly, savedIds, advancedOk, selectedTools]);

  const categoryOptions = CATEGORY_HUBS.map((hub) => hub.slug);

  const skillOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    const known = new Set(KNOWN_TOOL_LABELS.map((tool) => tool.toLowerCase()));
    for (const job of facet.toolJobs) {
      for (const raw of job.tools || []) {
        const label = canonicalTool(raw);
        const key = label.toLowerCase();
        if (!label || label.length > 28 || seen.has(key) || workModeFromPlaceLabel(label)) continue;
        seen.add(key);
        out.push(label);
      }
      for (const raw of job.tags || []) {
        const label = canonicalTool(raw);
        const key = label.toLowerCase();
        if (!known.has(key) || seen.has(key)) continue;
        seen.add(key);
        out.push(label);
      }
    }
    return out.sort((a, b) => a.localeCompare(b));
  }, [facet.toolJobs]);

  const skillsSummary = useMemo(() => {
    if (selectedTools.length === 0) return "";
    if (selectedTools.length === 1) return selectedTools[0];
    return `${selectedTools[0]} +${selectedTools.length - 1}`;
  }, [selectedTools]);

  const FilterContent = ({ variant }: { variant: "sidebar" | "sheet" }) => (
    <div
      className={[
        variant === "sidebar"
          ? `sticky top-16 z-30 max-h-[calc(100vh-4.5rem)] ${openWwrDropdown ? "overflow-visible" : "overflow-y-auto"}`
          : "",
        "rounded-2xl border border-slate-200 bg-white shadow-sm",
      ].join(" ")}
    >
      <div ref={variant === "sidebar" ? filterScrollRef : undefined} className={variant === "sheet" ? "p-3 [&_.cp-field]:mt-1 [&_.cp-field]:h-9" : "p-4"}>
        <div className={["flex items-start justify-between gap-3", variant === "sheet" ? "hidden" : ""].join(" ")}>
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

        <div className={variant === "sheet" ? "space-y-2" : "mt-4 space-y-3"}>
          {/* Job Categories */}
          <div className="relative" data-wwr-filter>
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
                {category !== "All Roles" ? getCategoryHub(category)?.label || category : "Any category"}
              </span>
            </button>
            {openWwrDropdown === "category" && (
              <div className="absolute left-0 right-0 z-40 mt-2 rounded-xl border border-slate-200 bg-white shadow-lg">
                <div className="py-1">
                  <button
                    type="button"
                    onClick={() =>
                      preserveFilterPosition(() => {
                        setCategory("All Roles");
                        setOpenWwrDropdown(null);
                      })
                    }
                    className={[
                      "w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-slate-50",
                      category === "All Roles" ? "bg-indigo-50 text-indigo-700" : "text-slate-900",
                    ].join(" ")}
                  >
                    <span>All categories</span>
                    <span className="text-xs text-slate-400">{facet.counts["All Roles"] || 0}</span>
                  </button>
                  {categoryOptions
                    .filter((c) => (facet.counts[c] || 0) > 0 || c === category)
                    .map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() =>
                          preserveFilterPosition(() => {
                            setCategory(c);
                            setOpenWwrDropdown(null);
                          })
                        }
                        className={[
                          "w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-slate-50",
                          category === c ? "bg-indigo-50 text-indigo-700" : "text-slate-900",
                        ].join(" ")}
                      >
                        <span>{getCategoryHub(c)?.label || c}</span>
                        <span className="text-xs text-slate-400">{facet.counts[c] || 0}</span>
                      </button>
                    ))}
                  {!advancedOk
                    ? categoryOptions
                        .filter((c) => (categoryCounts[c] || 0) === 0 && (lockedCategoryCounts[c] || 0) > 0)
                        .map((c) => (
                          <Link
                            key={c}
                            href={boardAccess === "registered" ? "/upgrade" : "/auth?from=%2Fjobs"}
                            className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-50"
                          >
                            <span>{getCategoryHub(c)?.label || c}</span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium">
                              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                                <rect x="5" y="11" width="14" height="9" rx="2" strokeWidth="2" />
                                <path strokeLinecap="round" strokeWidth="2" d="M8 11V8a4 4 0 018 0v3" />
                              </svg>
                              Locked
                            </span>
                          </Link>
                        ))
                    : null}
                </div>
              </div>
            )}
          </div>

          {/* Location */}
          <div className="relative" data-wwr-filter>
            <div className="text-[11px] font-medium text-slate-700 flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21s7-4.35 7-11a7 7 0 10-14 0c0 6.65 7 11 7 11z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
              Location
            </div>
            <div className="relative mt-2">
              <button
                type="button"
                onClick={() =>
                  setOpenWwrDropdown((prev) => {
                    const next = prev === "country" ? null : "country";
                    if (next === "country") setWwrLocationQuery("");
                    return next;
                  })
                }
                className="cp-field w-full h-10 rounded-xl bg-white pl-3 pr-9 text-left text-sm font-medium text-slate-900"
              >
                <span className={locationQuery.trim() ? "" : "text-slate-400"}>
                  {locationQuery.trim() || "Any location"}
                </span>
              </button>
              {locationQuery.trim() ? (
                <button
                  type="button"
                  aria-label="Clear location"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    preserveFilterPosition(() => {
                      setLocationQuery("");
                      setWwrLocationQuery("");
                      setOpenWwrDropdown(null);
                    });
                  }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  ×
                </button>
              ) : null}
            </div>
            {openWwrDropdown === "country" && (
              <div className="absolute left-0 right-0 top-full z-30 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                <div className="p-2 border-b border-slate-100">
                  <input
                    value={wwrLocationQuery}
                    onChange={(e) => setWwrLocationQuery(e.target.value)}
                    placeholder="City or country"
                    className="w-full h-10 rounded-lg border border-slate-200 px-3 text-[16px] font-medium text-slate-900 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 placeholder:text-slate-400"
                  />
                </div>
                <div className="max-h-[6.75rem] overflow-y-auto overscroll-contain py-1">
                  <button
                    type="button"
                    onClick={() =>
                      preserveFilterPosition(() => {
                        setLocationQuery("");
                        setWwrLocationQuery("");
                        setOpenWwrDropdown(null);
                      })
                    }
                    className="w-full text-left px-3 py-2 text-sm font-medium hover:bg-slate-50 text-slate-500"
                  >
                    Any location
                  </button>
                  {facet.locations
                    .filter((c) => c.toLowerCase().includes(wwrLocationQuery.trim().toLowerCase()))
                    .map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() =>
                          preserveFilterPosition(() => {
                            setLocationQuery(c);
                            setWwrLocationQuery("");
                            setOpenWwrDropdown(null);
                          })
                        }
                        className={[
                          "w-full text-left px-3 py-2 text-sm font-medium hover:bg-slate-50",
                          locationQuery === c ? "bg-indigo-50 text-indigo-700" : "text-slate-900",
                        ].join(" ")}
                      >
                        {c}
                      </button>
                    ))}
                  {facet.locations.filter((c) => c.toLowerCase().includes(wwrLocationQuery.trim().toLowerCase())).length === 0 && (
                    <div className="px-3 py-2 text-sm text-slate-500">No matching locations on the board.</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="relative" data-wwr-filter>
            <div className="text-[11px] font-medium text-slate-700 flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12h4l3-8 4 16 3-8h4" />
              </svg>
              Work mode
            </div>
            <button
              type="button"
              onClick={() => setOpenWwrDropdown((prev) => (prev === "work" ? null : "work"))}
              className="cp-field mt-2 w-full h-10 rounded-xl bg-white px-3 text-left text-sm font-medium text-slate-900"
            >
              <span className={workMode === "All" ? "text-slate-400" : ""}>
                {workMode === "All" ? "Any" : workMode}
              </span>
            </button>
            {openWwrDropdown === "work" && (
              <div className="absolute z-30 mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                <div className="py-1">
                  {workModes
                    .filter((mode) => {
                      if (mode === "All" || mode === workMode) return true;
                      return facet.workCounts[mode] > 0;
                    })
                    .map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() =>
                        preserveFilterPosition(() => {
                          setWorkMode(mode);
                          setOpenWwrDropdown(null);
                        })
                      }
                      className={[
                        "w-full text-left px-3 py-2 text-sm font-medium hover:bg-slate-50",
                        workMode === mode ? "bg-indigo-50 text-indigo-700" : mode === "All" ? "text-slate-500" : "text-slate-900",
                      ].join(" ")}
                    >
                      {mode === "All" ? "Any" : mode}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {advancedOk ? (
          <>
          <SalaryRangeSlider
            min={salaryMin}
            max={salaryMax}
            onChange={(nextMin, nextMax) => {
              setSalaryMin(nextMin);
              setSalaryMax(nextMax);
            }}
          />

          {/* Skills */}
          <div className="relative" data-wwr-filter>
            <div className="text-[11px] font-medium text-slate-700 flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-7 4h8m2 5H6a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v14a2 2 0 01-2 2z" />
              </svg>
              Tools
            </div>
            <button
              type="button"
              onClick={() => setOpenWwrDropdown((prev) => (prev === "skills" ? null : "skills"))}
              className="cp-field mt-2 w-full h-10 rounded-xl bg-white px-3 text-left text-sm font-medium text-slate-900"
            >
              <span className={skillsSummary ? "" : "text-slate-400"}>
                {skillsSummary || "Any tool"}
              </span>
            </button>
            {openWwrDropdown === "skills" && (
              <div className="absolute left-0 right-0 bottom-full z-30 mb-1 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
                <div className="p-2 border-b border-slate-100">
                  <input
                    value={wwrSkillQuery}
                    onChange={(e) => setWwrSkillQuery(e.target.value)}
                    placeholder="Search tools..."
                    className="w-full h-10 rounded-lg border border-slate-200 px-3 text-[16px] font-medium text-slate-900 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 placeholder:text-slate-400"
                  />
                </div>
                <div className="max-h-[6.75rem] overflow-y-auto overscroll-contain py-1">
                  {skillOptions.filter((t) => t.toLowerCase().includes(wwrSkillQuery.trim().toLowerCase())).length === 0 && (
                    <div className="px-3 py-2 text-sm text-slate-500">No matching tools on the board.</div>
                  )}
                  {skillOptions.filter((t) => t.toLowerCase().includes(wwrSkillQuery.trim().toLowerCase())).map((tool) => {
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
          </>
          ) : null}

          {activeFilterChips.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {activeFilterChips.map((chip, index) => (
                <button
                  key={`${chip.label}-${index}`}
                  type="button"
                  onClick={() => preserveFilterPosition(chip.onClear)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:border-indigo-200 hover:text-indigo-600"
                >
                  {chip.label}
                  <span className="text-[10px]">×</span>
                </button>
              ))}
            </div>
          ) : null}

          {variant === "sheet" ? (
            <div>
              <div className="text-[11px] font-medium text-slate-700">Sort</div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="cp-field mt-2 w-full h-10 rounded-xl bg-white px-3 text-sm font-medium text-slate-900 outline-none"
              >
                <option value="relevant">Most relevant</option>
                <option value="newest">Newest</option>
                <option value="salary">Highest salary</option>
              </select>
            </div>
          ) : null}

        </div>
      </div>
    </div>
  );

  const matchingCount = filteredAndSorted.length;
  const openRoles = typeof boardTotal === "number" ? boardTotal : matchingCount;
  const roleWord = openRoles === 1 ? "role" : "roles";
  const searchSummary = !filtersNarrow
    ? `${openRoles} ${roleWord}`
    : `${matchingCount} of ${openRoles} ${roleWord}`;
  const showRolesLabel = `Show ${matchingCount} ${matchingCount === 1 ? "role" : "roles"}`;
  const activeSummary = activeFilterChips
    .map((chip) => chip.label.replace(/^Search: |^Location: |^Tools: |^Seniority: /, ""))
    .join(" · ");

  return (
    <div className="overflow-x-clip bg-[#F8F9FD]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2 sm:py-3 lg:grid lg:grid-cols-12 lg:items-start lg:gap-4">
        <aside className="hidden lg:col-span-3 lg:row-span-2 lg:block lg:self-stretch">
          {isDesktop ? FilterContent({ variant: "sidebar" }) : null}
        </aside>
        <div className="lg:col-span-9">
          <div className="cp-search rounded-xl px-3 sm:px-4 py-2">
            {boardAccess !== "paid" ? (
              <div className="mb-2 flex items-center justify-end gap-2">
                <Link
                  href={boardAccess === "guest" ? "/auth?from=%2Fupgrade" : "/upgrade"}
                  onClick={() => trackFunnel("premium_click", { from: "jobs_top" })}
                  className="inline-flex h-8 items-center rounded-lg bg-indigo-600 px-3 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  Get Premium
                </Link>
                <span className="group relative">
                  <button
                    type="button"
                    aria-label="What Premium includes"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-medium text-slate-500 hover:border-indigo-200 hover:text-indigo-700"
                  >
                    ?
                  </button>
                  <span className="pointer-events-none absolute right-0 top-full z-30 mt-1 hidden w-72 rounded-lg border border-slate-200 bg-white p-3 text-left text-xs font-normal leading-5 text-slate-600 shadow-lg group-hover:block group-focus-within:block">
                    Premium is $11.99 a month. It adds more than one saved search and an email after each search when a role matches your category, salary floor, and stored tools, including the first 24 hours. A free account gets that search on Tuesday and Friday, after the role is public.
                  </span>
                </span>
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_minmax(0,11rem)_auto] lg:items-end lg:gap-3">
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

                <div className="hidden lg:block">
                  <label className="text-[10px] font-medium text-slate-500">
                    Sort
                  </label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="cp-field mt-1 w-full h-10 rounded-lg bg-white px-3 text-sm text-slate-800 outline-none"
                  >
                    <option value="relevant">Most relevant</option>
                    <option value="newest">Newest</option>
                    <option value="salary">Highest salary</option>
                  </select>
                </div>

              <div>
                <label className="hidden lg:block text-[10px] font-medium text-slate-500">&nbsp;</label>
                <div className="mt-1 flex items-center gap-2">
                  {canUseSaved && (
                    <button
                      onClick={() => setShowSavedOnly((prev) => !prev)}
                      disabled={savedCount === 0}
                      aria-pressed={showSavedOnly}
                      className={`hidden lg:inline-flex h-10 px-3 items-center justify-center whitespace-nowrap rounded-lg border text-sm font-medium leading-none transition-colors ${
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
                    className="hidden lg:inline-flex h-10 px-3 items-center justify-center rounded-lg border border-slate-300 bg-white text-sm font-medium leading-none text-slate-600 hover:border-indigo-200 hover:text-indigo-700"
                  >
                    Reset
                  </button>
                  {activeFilterChips.length > 0 ? (
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:border-indigo-200 hover:text-indigo-700 lg:hidden"
                    >
                      Clear
                    </button>
                  ) : null}
                  <button
                    onClick={() => setIsFilterOpen(true)}
                    className="lg:hidden inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-black"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M7 12h10M10 18h4" />
                    </svg>
                    Filters
                    {activeFilterChips.length > 0 ? (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-semibold text-slate-900">
                        {activeFilterChips.length}
                      </span>
                    ) : null}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-slate-800 lg:hidden" aria-live="polite">
                  {searchSummary}
                </p>
                <p className="mt-0.5 truncate text-[12px] text-slate-500 lg:hidden">
                  {activeSummary ||
                    (boardAccess === "paid"
                      ? "Newest roles stay at the top for 7 days."
                      : "New roles stay on Premium for the first 24 hours.")}
                </p>
                <div className="hidden min-w-0 items-center gap-2 lg:flex">
                  <span className="text-[13px] font-medium text-slate-700" aria-live="polite">
                    {accessHeadline}
                  </span>
                </div>
                <p className="mt-1 hidden text-[12px] font-medium leading-5 text-slate-500 lg:block">
                  {boardAccess === "paid"
                    ? "Most relevant keeps roles from the last 7 days at the top. You see a role as soon as it is published."
                    : "Roles from the last 24 hours are on Premium first, then they appear here."}
                </p>
                {hiddenSentences ? (
                  <p className="mt-0.5 hidden text-[12px] font-medium leading-5 text-slate-500 lg:block">
                    {hiddenSentences.free ? (
                      <Link
                        href="/auth?from=%2Fjobs"
                        onClick={() => trackFunnel("signup_started", { from: "hidden_jobs" })}
                        className="hover:text-indigo-700"
                      >
                        {hiddenSentences.free}
                      </Link>
                    ) : null}
                    {hiddenSentences.free ? " " : null}
                    <Link
                      href={boardAccess === "guest" ? "/auth?from=%2Fupgrade" : "/upgrade"}
                      onClick={() => trackFunnel("premium_click", { from: "hidden_jobs" })}
                      className="hover:text-indigo-700"
                    >
                      {hiddenSentences.premium}
                    </Link>
                  </p>
                ) : null}
              </div>
              <div className="hidden sm:flex items-center gap-3">
                <Link
                  href={
                    category && category !== "All Roles"
                      ? `/alerts?category=${encodeURIComponent(category)}`
                      : query.trim()
                        ? `/alerts?query=${encodeURIComponent(query.trim())}`
                        : "/alerts"
                  }
                  className="text-sm font-medium text-indigo-700 hover:text-indigo-800"
                >
                  Get email alerts
                </Link>
              </div>
            </div>

          </div>
        </div>

          <div className="mt-3 space-y-2 lg:col-span-5 lg:mt-0 lg:space-y-3">
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
                          setSelectedJobId(null);
                          setExpandedJobId((prev) => (prev === job.id ? null : job.id));
                        }}
                        onApply={() => handleApply(job)}
                        onOpenRole={() => rememberPlace(job.id)}
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
                      setSelectedJobId(null);
                      setExpandedJobId((prev) => (prev === job.id ? null : job.id));
                    }}
                    onApply={() => handleApply(job)}
                    onOpenRole={() => rememberPlace(job.id)}
                  />
                </div>
              );
            })}

            {!filtersNarrow && (boardJobs.length > visibleCount || canLoadMore) && (
              <div ref={loadSentinelRef} className="pt-4 pb-2 text-center text-sm text-slate-400">
                Loading more roles
              </div>
            )}

            {lockedShown.length > 0 ? (
              <div className="space-y-3">
                {lockedShown.map((job) => {
                  const href = boardAccess === "guest" ? "/auth?from=%2Fjobs" : "/upgrade";
                  const label = boardAccess === "guest"
                    ? "Create a free account to unlock more jobs"
                    : "Upgrade to Premium to unlock all jobs";
                  return (
                    <div key={job.id} className="relative overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <div className="pointer-events-none select-none px-4 py-4 opacity-60 blur-[1.5px]" aria-hidden="true">
                        <div className="text-[15px] font-bold text-slate-900">{job.title}</div>
                        <div className="mt-1 text-sm text-slate-600">
                          {job.company}
                          <span className="text-slate-300"> · </span>
                          {job.location}
                        </div>
                      </div>
                      <Link
                        href={href}
                        onClick={() =>
                          trackFunnel(boardAccess === "guest" ? "signup_started" : "premium_click", { from: "locked_job" })
                        }
                        aria-label={label}
                        className="absolute inset-0 flex items-center justify-center bg-white/50"
                      >
                        <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm">
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                            <rect x="5" y="11" width="14" height="9" rx="2" strokeWidth="2" />
                            <path strokeLinecap="round" strokeWidth="2" d="M8 11V8a4 4 0 018 0v3" />
                          </svg>
                          Locked
                        </span>
                      </Link>
                    </div>
                  );
                })}
                <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-4 text-center">
                  <p className="text-sm font-medium text-slate-800">
                    {boardAccess === "guest"
                      ? "A free account shows more of the newest jobs."
                      : hiddenNote?.tier === "registered"
                        ? `${hiddenNote.premiumMore} more live ${hiddenNote.premiumMore === 1 ? "job is" : "jobs are"} on Premium.`
                        : "More live jobs are on Premium."}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {boardAccess === "guest" && hiddenNote?.tier === "guest" && hiddenNote.premiumMore > 0
                      ? "Premium adds more than one saved search, an email after each search, and roles from the first 24 hours."
                      : "More than one saved search and an email after each search are on Premium."}
                  </p>
                  <Link
                    href={boardAccess === "guest" ? "/auth?from=%2Fjobs" : "/upgrade"}
                    onClick={() =>
                      trackFunnel(boardAccess === "guest" ? "signup_started" : "premium_click", { from: "search_limit" })
                    }
                    className="mt-3 inline-flex h-10 items-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    {boardAccess === "guest" ? "Create a free account" : "Unlock all live jobs"}
                  </Link>
                </div>
              </div>
            ) : showSearchLimitCta ? (
              <div className="mt-2 rounded-xl border border-slate-200 bg-white px-4 py-4">
                <p className="text-sm text-slate-700 leading-relaxed">
                  {boardAccess === "guest"
                    ? "More live jobs are on the board. Create a free account to unlock more roles."
                    : "More live jobs are available with Premium."}
                </p>
                <Link
                  href={boardAccess === "guest" ? "/auth?from=%2Fjobs" : "/upgrade"}
                  onClick={() =>
                    trackFunnel(boardAccess === "guest" ? "signup_started" : "premium_click", { from: "search_limit" })
                  }
                  className="mt-3 inline-flex h-10 items-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  {boardAccess === "guest" ? "Create a free account" : "Unlock all live jobs"}
                </Link>
              </div>
            ) : null}

            {filteredAndSorted.length === 0 && (
              <div className="bg-white py-8 rounded-xl text-center border border-dashed border-slate-200">
                <p className="text-sm font-medium text-slate-500">No matches</p>
                <p className="mt-2 text-base font-semibold text-slate-900">
                  {showSavedOnly ? "No saved roles yet." : "No roles match your current filters."}
                </p>
                <p className="mt-2 text-slate-500 font-medium">
                  Try fewer keywords or reset filters. Or get an email when a matching role is published.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                  {CATEGORY_HUBS.map((hub) => (
                    <button
                      key={hub.slug}
                      onClick={() => setCategory(hub.slug)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium text-slate-700 border border-slate-200 bg-white hover:border-indigo-200"
                    >
                      {hub.label}
                    </button>
                  ))}
                </div>
                <div className="mt-6 flex items-center justify-center gap-3">
                  <button
                    onClick={clearAllFilters}
                    className="h-10 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-black"
                  >
                    Reset filters
                  </button>
                  <Link
                    href="/alerts"
                    className="inline-flex h-10 items-center px-4 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-800 text-sm font-medium hover:bg-indigo-100"
                  >
                    Get email alerts
                  </Link>
                </div>
              </div>
            )}
          </div>

          <aside className="hidden lg:block lg:col-span-4 lg:self-stretch">
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

      {showMobileFilterBar ? (
        <div className="fixed inset-x-0 top-14 z-40 border-b border-slate-200 bg-[#F8F9FD] px-4 py-2 lg:hidden">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-800">{searchSummary}</p>
            {activeFilterChips.length > 0 ? (
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex h-9 shrink-0 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700"
              >
                Clear
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setIsFilterOpen(true)}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-sm font-medium text-white"
            >
              Filters
              {activeFilterChips.length > 0 ? (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-semibold text-slate-900">
                  {activeFilterChips.length}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      ) : null}

      {isFilterOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-x-0 z-[120] flex items-start justify-center px-3"
              style={{
                top: filterFrame?.top ?? 0,
                height: filterFrame?.height ?? "100svh",
                paddingTop: "max(8px, env(safe-area-inset-top))",
                paddingBottom: "max(8px, env(safe-area-inset-bottom))",
              }}
              role="dialog"
              aria-modal="true"
              aria-label="Filters"
              onClick={() => setIsFilterOpen(false)}
            >
              <div className="absolute inset-0 bg-slate-900/40" />
              <div
                className="relative flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[#F8F9FD] shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-3">
                  <div>
                    <div className="text-sm font-semibold leading-5 text-slate-900">Filters</div>
                    <div className="mt-0.5 text-xs text-slate-500">{searchSummary}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        clearAllFilters();
                        setOpenWwrDropdown(null);
                      }}
                      className="text-xs font-medium text-slate-500 hover:text-slate-900"
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => setIsFilterOpen(false)}
                      className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200/70 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-700"
                      aria-label="Close filters"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div data-filter-scroll className="min-h-0 flex-1 overflow-y-auto px-3 pb-2">
                  {FilterContent({ variant: "sheet" })}
                </div>
                <div className="shrink-0 border-t border-slate-200 bg-[#F8F9FD] px-3 py-2">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenWwrDropdown(null);
                      setIsFilterOpen(false);
                    }}
                    className="h-11 w-full rounded-lg bg-slate-900 text-sm font-medium text-white hover:bg-black"
                  >
                    {showRolesLabel}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
};

export default FindJobs;
