"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import FindJobs from "../../components/FindJobs";
import { Job, UserSession } from "../../types";
import { useSupabaseAuth } from "../../components/Providers";
import { authFetch } from "../../lib/authFetch";

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
  initialTotal,
  initialQuery,
  initialLocation,
}: {
  initialJobs: Job[];
  initialTotal: number;
  initialQuery: string;
  initialLocation: string;
}) {
  const router = useRouter();
  const { profile, accessToken, loading: authLoading } = useSupabaseAuth();
  const [jobs, setJobs] = useState<Job[]>(() => initialJobs || []);
  const [boardAccess, setBoardAccess] = useState<"guest" | "registered" | "paid">("guest");
  const [boardTotal, setBoardTotal] = useState(initialTotal);
  const [loadingMore, setLoadingMore] = useState(false);
  const [savedJobIds, setSavedJobIds] = useState<string[]>(() => getSaved());

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
        };
        if (cancelled) return;
        if (Array.isArray(data.jobs)) setJobs(data.jobs);
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
  }, [accessToken, authLoading]);

  const loadMore = async () => {
    if (boardAccess !== "paid" || loadingMore || jobs.length >= boardTotal) return;
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
        canLoadMore={boardAccess === "paid" && jobs.length < boardTotal}
        onLoadMore={loadMore}
        onToggleBookmark={handleToggleBookmark}
      />
    </>
  );
}

