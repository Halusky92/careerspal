"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import FindJobs from "../../components/FindJobs";
import { Job, UserSession } from "../../types";
import type { LockedBoardPreview } from "../../lib/boardAccess";
import { useSupabaseAuth } from "../../components/Providers";
import { authFetch } from "../../lib/authFetch";
import { JOBS_RETURN_KEY, readJobsReturnPlace } from "../../lib/jobsReturn";

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
  initialQuery,
  initialLocation,
  initialAccess = "guest",
}: {
  initialJobs: Job[];
  initialLocked?: LockedBoardPreview[];
  initialCompanies?: number;
  initialTotal: number | null;
  initialCategoryTotals?: Record<string, number>;
  initialQuery: string;
  initialLocation: string;
  initialAccess?: "guest" | "registered" | "paid";
}) {
  const router = useRouter();
  const { profile, accessToken, loading: authLoading } = useSupabaseAuth();
  const [jobs, setJobs] = useState<Job[]>(() => initialJobs || []);
  const [lockedJobs, setLockedJobs] = useState<LockedBoardPreview[]>(() => initialLocked);
  const [companyCount, setCompanyCount] = useState(initialCompanies);
  const [boardAccess, setBoardAccess] = useState<"guest" | "registered" | "paid">(initialAccess);
  const [boardTotal, setBoardTotal] = useState(initialTotal);
  const [loadingMore, setLoadingMore] = useState(false);
  const [savedJobIds, setSavedJobIds] = useState<string[]>(() => getSaved());
  const fillingRef = useRef(false);

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

  useEffect(() => {
    if (authLoading) return;
    // The server already rendered this signed-in tier from the session cookie.
    // Fetching again is what flashed the guest locks and jumped the list.
    if (initialAccess !== "guest") return;
    if (!accessToken) return;
    let cancelled = false;
    const load = async () => {
      try {
        const response = accessToken
          ? await authFetch("/api/jobs?limit=50", {}, accessToken)
          : await fetch("/api/jobs?limit=50");
        const data = (await response.json()) as {
          jobs?: Job[];
          total?: number;
          access?: "guest" | "registered" | "paid";
          locked?: LockedBoardPreview[];
          companies?: number;
        };
        if (cancelled) return;
        if (Array.isArray(data.jobs)) setJobs(data.jobs);
        if (Array.isArray(data.locked)) setLockedJobs(data.locked);
        if (typeof data.companies === "number") setCompanyCount(data.companies);
        if (typeof data.total === "number") setBoardTotal(data.total);
        if (data.access) setBoardAccess(data.access);
      } catch {
        // keep the guest slice from the server
      }
    };
    load();
    return () => {
      cancelled = true;
    };
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
        const response = accessToken
          ? await authFetch(`/api/jobs?limit=50&skip=${loaded}`, {}, accessToken)
          : await fetch(`/api/jobs?limit=50&skip=${loaded}`);
        const data = (await response.json()) as { jobs?: Job[] };
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

  // The first paint is one page. Filters and category counts need every role this visitor may open.
  useEffect(() => {
    if (authLoading || fillingRef.current) return;
    if (typeof boardTotal !== "number" || jobs.length >= boardTotal) return;
    fillingRef.current = true;
    let cancelled = false;
    const fill = async () => {
      let loaded = jobs.length;
      let guard = 0;
      try {
        while (!cancelled && loaded < boardTotal && guard < 40) {
          guard += 1;
          const response = accessToken
            ? await authFetch(`/api/jobs?limit=50&skip=${loaded}`, {}, accessToken)
            : await fetch(`/api/jobs?limit=50&skip=${loaded}`);
          const data = (await response.json()) as { jobs?: Job[] };
          const next = Array.isArray(data.jobs) ? data.jobs : [];
          if (next.length === 0) return;
          loaded += next.length;
          if (cancelled) return;
          setJobs((prev) => {
            const seen = new Set(prev.map((job) => job.id));
            return [...prev, ...next.filter((job) => !seen.has(job.id))];
          });
        }
      } catch {
        // the first page stays usable
      } finally {
        fillingRef.current = false;
      }
    };
    fill();
    return () => {
      cancelled = true;
      fillingRef.current = false;
    };
  }, [accessToken, authLoading, boardTotal, jobs.length]);

  const loadMore = async () => {
    if (loadingMore || typeof boardTotal !== "number" || jobs.length >= boardTotal) return;
    setLoadingMore(true);
    try {
      const response = accessToken
        ? await authFetch(`/api/jobs?limit=50&skip=${jobs.length}`, {}, accessToken)
        : await fetch(`/api/jobs?limit=50&skip=${jobs.length}`);
      const data = (await response.json()) as { jobs?: Job[] };
      const next = Array.isArray(data.jobs) ? data.jobs : [];
      setJobs((prev) => {
        const seen = new Set(prev.map((job) => job.id));
        return [...prev, ...next.filter((job) => !seen.has(job.id))];
      });
    } catch {
      // keep the page already loaded
    } finally {
      setLoadingMore(false);
    }
  };

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
        categoryTotals={initialCategoryTotals}
        canLoadMore={typeof boardTotal === "number" && jobs.length < boardTotal}
        onLoadMore={loadMore}
        onToggleBookmark={handleToggleBookmark}
      />
    </>
  );
}

