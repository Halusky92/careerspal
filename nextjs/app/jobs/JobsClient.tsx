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
  initialTotal: _initialTotal,
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
  const [jobs] = useState<Job[]>(() => initialJobs || []);
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
        onToggleBookmark={handleToggleBookmark}
      />
    </>
  );
}

