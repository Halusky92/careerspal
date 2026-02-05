'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import FindJobs from '../../components/FindJobs';
import { getAllJobs } from '../../lib/jobs';
import { UserSession } from '../../types';
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
  const [jobs, setJobs] = useState(() => getAllJobs());
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
    <div className="pt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600"
        >
          <span>← Back</span>
        </button>
      </div>
      <section className="relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-15%] w-[70%] h-[70%] bg-indigo-300/20 rounded-full blur-[140px]"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-violet-400/20 rounded-full blur-[140px]"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 relative z-10">
          <div className="bg-white/80 backdrop-blur border border-slate-200/60 rounded-[2.5rem] p-8 sm:p-12 shadow-[0_25px_70px_rgba(15,23,42,0.08)]">
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Premium job board</p>
            <h1 className="text-3xl sm:text-5xl font-black text-slate-900 mt-3 tracking-tight">
              Curated roles for systems-first teams.
            </h1>
            <p className="text-slate-500 font-medium mt-3 max-w-2xl">
              Every listing is reviewed, salary-transparent, and mapped to the tools you use. Build your next chapter with confidence.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                {isLoading ? 'Loading…' : `${totalJobs ?? jobs.length} live roles`}
              </div>
              {profile?.role !== "employer" && (
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500" aria-live="polite">
                  Saved {savedJobIds.length}
                </div>
              )}
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <span className="px-3 py-1 rounded-full border border-slate-200 bg-white">Search by title</span>
              <span className="px-3 py-1 rounded-full border border-slate-200 bg-white">Filter by location</span>
              <span className="px-3 py-1 rounded-full border border-slate-200 bg-white">Verified employers only</span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
              {["Notion Ops", "Automation", "Remote EU", "Head of Ops", "Zapier"].map((tag) => (
                <span key={tag} className="px-3 py-1 rounded-full border border-indigo-100 bg-indigo-50 text-indigo-600">
                  {tag}
                </span>
              ))}
            </div>
            <div className="mt-6">
              {profile?.role === "employer" ? (
                <button
                  onClick={() => router.push("/post-a-job")}
                  disabled={authLoading}
                  className="px-6 py-3 rounded-2xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-black"
                >
                  Post a job
                </button>
              ) : (
                <button
                  onClick={() => router.push(accessToken ? "/account" : "/auth")}
                  disabled={authLoading}
                  className="px-6 py-3 rounded-2xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-black"
                >
                  Create job alert
                </button>
              )}
            </div>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: "Verified employers", value: "100%" },
                { label: "Median response", value: "6 days" },
                { label: "Remote-friendly", value: "92%" },
              ].map((item) => (
                <div key={item.label} className="bg-white border border-slate-200/60 rounded-2xl px-4 py-4 text-center">
                  <div className="text-2xl font-black text-slate-900">{item.value}</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{item.label}</div>
                </div>
              ))}
            </div>
            {!accessToken && !authLoading && (
              <div className="mt-8 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Sync saved roles</p>
                  <p className="text-sm font-bold text-slate-700">Sign in to keep your saved roles across devices.</p>
                </div>
                <button
                  onClick={() => router.push("/auth")}
                  className="px-4 py-2 rounded-full bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest"
                >
                  Sign in
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

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
