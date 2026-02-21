'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import FindJobs from '../../components/FindJobs';
import { Job, UserSession } from '../../types';
import { useSupabaseAuth } from '../../components/Providers';
import { authFetch } from '../../lib/authFetch';

const STORAGE_KEY = 'cp_saved_jobs';

const getSaved = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
};

const setSaved = (ids: string[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
};

export default function JobsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile, accessToken, loading: authLoading } = useSupabaseAuth();
  const initialQuery = searchParams.get('query') || '';
  const initialLocation = searchParams.get('location') || '';
  const handleQueryUpdate = (nextQuery: string, nextLocation: string) => {
    const params = new URLSearchParams(window.location.search);
    if (nextQuery) {
      params.set('query', nextQuery);
    } else {
      params.delete('query');
    }
    if (nextLocation) {
      params.set('location', nextLocation);
    } else {
      params.delete('location');
    }
    const qs = params.toString();
    router.replace(qs ? `/jobs?${qs}` : '/jobs', { scroll: false });
  };
  const [jobs, setJobs] = useState<Job[]>([]);
  const [totalJobs, setTotalJobs] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savedJobIds, setSavedJobIds] = useState<string[]>(() => getSaved());

  useEffect(() => {
    const loadJobs = async () => {
      try {
        const response = await fetch("/api/jobs?limit=200");
        const data = (await response.json()) as { jobs?: typeof jobs; total?: number };
        if (Array.isArray(data.jobs)) {
          setJobs(data.jobs);
        }
        if (typeof data.total === "number") {
          setTotalJobs(data.total);
        }
      } catch {
        // keep fallback
      } finally {
        setIsLoading(false);
      }
    };
    loadJobs();
  }, []);

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
      email: profile?.email || 'guest@careerspal.com',
      role: (profile?.role as UserSession["role"]) || 'candidate',
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
    <div className="pt-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600"
          >
            <span>← Back</span>
          </button>
          <div className="flex items-center gap-2">
            <div className="hidden sm:inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
              {isLoading ? "Loading…" : (totalJobs ?? jobs.length) > 0 ? `${totalJobs ?? jobs.length} roles` : "Roles reviewed daily"}
            </div>
            {profile?.role !== "employer" && (
              <div className="hidden sm:inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                Saved {savedJobIds.length}
              </div>
            )}
            <button
              onClick={() => router.push(profile?.role === "employer" ? "/post-a-job" : accessToken ? "/account" : "/auth")}
              disabled={authLoading}
              className="h-10 px-4 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-black disabled:opacity-60"
            >
              {profile?.role === "employer" ? "Post a job" : "Job alerts"}
            </button>
          </div>
        </div>
      </div>

      <FindJobs
        jobs={jobs}
        initialQuery={initialQuery}
        initialLocationQuery={initialLocation}
        user={user}
        onToggleBookmark={handleToggleBookmark}
        onQueryUpdate={handleQueryUpdate}
      />
    </div>
  );
}
