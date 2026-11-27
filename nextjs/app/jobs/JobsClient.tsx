"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import FindJobs from "../../components/FindJobs";
import { Job, UserSession } from "../../types";
import type { LockedBoardPreview } from "../../lib/boardAccess";
import { useSupabaseAuth } from "../../components/Providers";
import { authFetch } from "../../lib/authFetch";
import { rememberBoardCache, peekBoardCache } from "../../lib/jobsBoardCache";
import { JOBS_RETURN_KEY, readJobsReturnPlace } from "../../lib/jobsReturn";
import { boardFilterKey, boardQueryString, EMPTY_BOARD_FILTERS, type BoardFacets, type BoardListFilters } from "../../lib/boardListQuery";

const STORAGE_KEY = "cp_saved_jobs";

const getSaved = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
};

const setSaved = (ids: string[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
};

export default function JobsClient({
  initialJobs,
  initialLocked = [],
  initialCompanies = 0,
  initialTotal,
  initialCategoryTotals,
  initialFacets,
  initialQuery,
  initialLocation,
  initialAccess = "guest",
  initialFilterKey = "",
}: {
  initialJobs: Job[];
  initialLocked?: LockedBoardPreview[];
  initialCompanies?: number;
  initialTotal: number | null;
  initialCategoryTotals?: Record<string, number>;
  initialFacets?: BoardFacets;
  initialQuery: string;
  initialLocation: string;
  initialAccess?: "guest" | "registered" | "paid";
  initialFilterKey?: string;
}) {
  const { profile, accessToken, loading: authLoading } = useSupabaseAuth();
  const [jobs, setJobs] = useState<Job[]>(() => initialJobs || []);
  const [lockedJobs, setLockedJobs] = useState<LockedBoardPreview[]>(() => initialLocked);
  const [companyCount, setCompanyCount] = useState(initialCompanies);
  const [boardAccess, setBoardAccess] = useState<"guest" | "registered" | "paid">(initialAccess);
  const [boardTotal, setBoardTotal] = useState(initialTotal);
  const [categoryTotals, setCategoryTotals] = useState(initialCategoryTotals);
  const [facets, setFacets] = useState(initialFacets);
  const [loadingMore, setLoadingMore] = useState(false);
  const [savedJobIds, setSavedJobIds] = useState<string[]>(() => getSaved());
  const filtersRef = useRef<BoardListFilters>(
    (() => {
      if (!initialFilterKey) return EMPTY_BOARD_FILTERS;
      try {
        return { ...EMPTY_BOARD_FILTERS, ...(JSON.parse(initialFilterKey) as BoardListFilters) };
      } catch {
        return EMPTY_BOARD_FILTERS;
      }
    })(),
  );
  const requestSeq = useRef(0);
  const loadedKey = useRef(initialFilterKey);

  useLayoutEffect(() => {
    const cached = peekBoardCache(initialAccess, loadedKey.current);
    if (!cached || cached.jobs.length <= jobs.length) return;
    setJobs(cached.jobs);
    if (typeof cached.total === "number") setBoardTotal(cached.total);
  }, [initialAccess, jobs.length]);

  useEffect(() => {
    rememberBoardCache({ access: boardAccess, key: loadedKey.current, jobs, total: boardTotal });
  }, [boardAccess, jobs, boardTotal]);

  useEffect(() => {
    const loadSaved = async () => {
      if (authLoading || !accessToken) return;
      try {
        const response = await authFetch("/api/saved-jobs", {}, accessToken);
        if (!response.ok) return;
        const data = (await response.json()) as { savedJobs?: { jobId: string }[] };
        const serverSaved = data.savedJobs?.map((item) => item.jobId) || [];
        const localSaved = getSaved();
        const merged = Array.from(new Set([...serverSaved, ...localSaved]));
        setSavedJobIds(merged);
        const missing = localSaved.filter((id) => !serverSaved.includes(id));
        if (missing.length > 0) {
          await Promise.all(
            missing.map((jobId) =>
              authFetch(
                "/api/saved-jobs",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ jobId }),
                },
                accessToken,
              ),
            ),
          );
          setSaved([]);
        }
      } catch {
        // noop
      }
    };
    loadSaved();
  }, [accessToken, authLoading]);

  const user = useMemo<UserSession>(
    () => ({
      email: profile?.email || "guest@careerspal.com",
      role: (profile?.role as UserSession["role"]) || "candidate",
      savedJobIds,
    }),
    [profile?.email, profile?.role, savedJobIds],
  );

  const syncSaved = async (jobId: string, isSaved: boolean, previous: string[]) => {
    try {
      if (!accessToken) return;
      await authFetch(
        "/api/saved-jobs",
        {
          method: isSaved ? "DELETE" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId }),
        },
        accessToken,
      );
    } catch {
      setSavedJobIds(previous);
    }
  };

  const readPage = useCallback(async (filters: BoardListFilters, skip: number) => {
    const qs = boardQueryString({ ...filters, savedIds: filters.saved ? savedJobIds : [] }, skip, 50);
    const response = accessToken ? await authFetch(`/api/jobs?${qs}`, {}, accessToken) : await fetch(`/api/jobs?${qs}`);
    return (await response.json()) as {
      jobs?: Job[];
      total?: number;
      access?: "guest" | "registered" | "paid";
      locked?: LockedBoardPreview[];
      companies?: number;
      categoryTotals?: Record<string, number>;
      facets?: BoardFacets;
    };
  }, [accessToken, savedJobIds]);

  useEffect(() => {
    if (authLoading) return;
    // The server already rendered this signed-in tier. Fetch again only when a guest
    // session appears, so Premium can see the first 24 hours.
    if (initialAccess !== "guest" || !accessToken) return;
    const seq = ++requestSeq.current;
    const load = async () => {
      try {
        const data = await readPage(filtersRef.current, 0);
        if (seq !== requestSeq.current) return;
        if (Array.isArray(data.jobs)) setJobs(data.jobs);
        if (Array.isArray(data.locked)) setLockedJobs(data.locked);
        if (typeof data.companies === "number") setCompanyCount(data.companies);
        if (typeof data.total === "number") setBoardTotal(data.total);
        if (data.categoryTotals) setCategoryTotals(data.categoryTotals);
        if (data.facets) setFacets(data.facets);
        if (data.access) setBoardAccess(data.access);
      } catch {
        // keep the guest slice from the server
      }
    };
    load();
    // saved ids are applied by the filter callback, not by this one-time tier refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, authLoading, initialAccess]);

  useEffect(() => {
    if (authLoading || initialAccess === "guest") return;
    let place: ReturnType<typeof readJobsReturnPlace> = null;
    try {
      place = readJobsReturnPlace(window.sessionStorage.getItem(JOBS_RETURN_KEY));
    } catch {
      place = null;
    }
    if (!place || place.loadedCount <= jobs.length) return;
    let cancelled = false;
    const fill = async () => {
      let loaded = jobs.length;
      let guard = 0;
      while (!cancelled && loaded < place.loadedCount && guard < 6) {
        guard += 1;
        const data = await readPage(filtersRef.current, loaded);
        const next = Array.isArray(data.jobs) ? data.jobs : [];
        if (next.length === 0) return;
        loaded += next.length;
        if (cancelled) return;
        setJobs((prev) => {
          const seen = new Set(prev.map((job) => job.id));
          return [...prev, ...next.filter((job) => !seen.has(job.id))];
        });
      }
    };
    fill();
    return () => {
      cancelled = true;
    };
    // Restore the pages that were already open. Later list growth must not fetch again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, authLoading, initialAccess]);

  const showAll = async () => {
    if (loadingMore || typeof boardTotal !== "number" || jobs.length >= boardTotal) return;
    setLoadingMore(true);
    const seq = requestSeq.current;
    try {
      let list = jobs;
      let guard = 0;
      while (list.length < boardTotal && guard < 8) {
        guard += 1;
        const data = await readPage(filtersRef.current, list.length);
        if (seq !== requestSeq.current) return;
        const next = Array.isArray(data.jobs) ? data.jobs : [];
        const seen = new Set(list.map((job) => job.id));
        const fresh = next.filter((job) => !seen.has(job.id));
        if (fresh.length === 0) break;
        list = [...list, ...fresh];
      }
      if (seq !== requestSeq.current) return;
      setJobs(list);
    } catch {
      // keep the page already loaded
    } finally {
      setLoadingMore(false);
    }
  };

  const onBoardQuery = useCallback((filters: BoardListFilters) => {
    const withSaved = { ...filters, savedIds: filters.saved ? savedJobIds : [] };
    const key = boardFilterKey(withSaved);
    filtersRef.current = withSaved;
    if (key === loadedKey.current) return;
    loadedKey.current = key;
    const seq = ++requestSeq.current;
    const load = async () => {
      try {
        const data = await readPage(withSaved, 0);
        if (seq !== requestSeq.current) return;
        if (Array.isArray(data.jobs)) setJobs(data.jobs);
        if (typeof data.total === "number") setBoardTotal(data.total);
        if (typeof data.companies === "number") setCompanyCount(data.companies);
        if (data.categoryTotals) setCategoryTotals(data.categoryTotals);
        if (data.facets) setFacets(data.facets);
        if (Array.isArray(data.locked)) setLockedJobs(data.locked);
        if (data.access) setBoardAccess(data.access);
      } catch {
        // keep the page already shown
      }
    };
    load();
  }, [readPage, savedJobIds]);

  const handleToggleBookmark = (jobId: string) => {
    setSavedJobIds((prev) => {
      const isSaved = prev.includes(jobId);
      const next = isSaved ? prev.filter((id) => id !== jobId) : [...prev, jobId];
      if (!accessToken) {
        setSaved(next);
      } else {
        syncSaved(jobId, isSaved, prev);
      }
      return next;
    });
  };

  return (
    <>
      <FindJobs
        jobs={jobs}
        initialQuery={initialQuery}
        initialLocationQuery={initialLocation}
        user={user}
        boardAccess={boardAccess}
        boardTotal={boardTotal}
        lockedJobs={lockedJobs}
        companyCount={companyCount}
        categoryTotals={categoryTotals}
        serverFacets={facets}
        canLoadMore={typeof boardTotal === "number" && jobs.length < boardTotal}
        loadingMore={loadingMore}
        onShowAll={showAll}
        onToggleBookmark={handleToggleBookmark}
        serverFiltered
        onBoardQuery={onBoardQuery}
      />
    </>
  );
}

