'use client';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Hero from "../components/Hero";
import HomePreviewCard from "../components/HomePreviewCard";
import { Job } from "../types";
import { isOnNicheJob } from "../lib/nicheScope";
import { isPaidFeaturedListing, sortFeaturedJobs } from "../lib/featuredListing";
import FeaturedBoardZone from "../components/FeaturedBoardZone";
import { useSupabaseAuth } from "../components/Providers";
import { authFetch } from "../lib/authFetch";

const PENDING_SAVE_KEY = "cp_pending_save_job";

export default function HomeClient({ initialJobs }: { initialJobs: Job[] }) {
  const router = useRouter();
  const { accessToken, loading: authLoading } = useSupabaseAuth();
  const [jobs, setJobs] = useState<Job[]>(() => initialJobs || []);
  const [jobsLoading, setJobsLoading] = useState(() => (initialJobs?.length ? false : true));
  const [isSmUp, setIsSmUp] = useState(false);
  const [savedJobIds, setSavedJobIds] = useState<string[]>([]);

  useEffect(() => {
    const loadSaved = async () => {
      if (authLoading || !accessToken) return;
      try {
        const response = await authFetch("/api/saved-jobs", {}, accessToken);
        if (!response.ok) return;
        const data = (await response.json()) as { savedJobs?: { jobId: string }[] };
        const serverSaved = data.savedJobs?.map((item) => item.jobId) || [];
        let pending = "";
        try {
          pending = sessionStorage.getItem(PENDING_SAVE_KEY) || "";
          sessionStorage.removeItem(PENDING_SAVE_KEY);
        } catch {
          pending = "";
        }
        const merged = Array.from(new Set([...serverSaved, ...(pending ? [pending] : [])]));
        setSavedJobIds(merged);
        if (pending && !serverSaved.includes(pending)) {
          await authFetch(
            "/api/saved-jobs",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ jobId: pending }),
            },
            accessToken,
          );
        }
      } catch {
        // keep empty
      }
    };
    loadSaved();
  }, [accessToken, authLoading]);

  useEffect(() => {
    const loadJobs = async () => {
      try {
        const response = await fetch("/api/jobs");
        const data = (await response.json()) as { jobs?: Job[] };
        if (Array.isArray(data.jobs)) {
          setJobs(data.jobs);
        }
      } catch {
        // keep fallback
      } finally {
        setJobsLoading(false);
      }
    };
    loadJobs();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 640px)");
    const update = () => setIsSmUp(mq.matches);
    update();
    try {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    } catch {
      mq.addListener(update);
      return () => mq.removeListener(update);
    }
  }, []);

  const liveJobs = useMemo(
    () =>
      [...jobs]
        .filter((job) => isOnNicheJob(job))
        .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)),
    [jobs],
  );
  const featuredPreview = useMemo(
    () => sortFeaturedJobs(liveJobs.filter(isPaidFeaturedListing)).slice(0, 3),
    [liveJobs],
  );
  const previewJobs = useMemo(() => {
    const rest = liveJobs.filter((job) => !isPaidFeaturedListing(job));
    const take = isSmUp ? 4 : 3;
    const room = featuredPreview.length > 0 ? Math.max(2, take - featuredPreview.length) : take;
    return rest.slice(0, room);
  }, [liveJobs, featuredPreview.length, isSmUp]);

  const hasJobs = jobs.length > 0;

  const handleToggleSave = (jobId: string) => {
    if (!accessToken) {
      try {
        sessionStorage.setItem(PENDING_SAVE_KEY, jobId);
      } catch {
        // ignore
      }
      router.push(`/auth?from=${encodeURIComponent("/")}`);
      return;
    }
    setSavedJobIds((prev) => {
      const isSaved = prev.includes(jobId);
      const next = isSaved ? prev.filter((id) => id !== jobId) : [...prev, jobId];
      void authFetch(
        "/api/saved-jobs",
        {
          method: isSaved ? "DELETE" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId }),
        },
        accessToken,
      ).catch(() => setSavedJobIds(prev));
      return next;
    });
  };

  return (
    <>
      <Hero onBrowse={() => router.push("/jobs")} onGetAlerts={() => router.push("/alerts")} />

      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-5 sm:py-7">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-slate-900">A few live roles</h2>
        </div>

        {jobsLoading && (
          <div className="space-y-2">
            <div className="h-14 rounded-xl bg-slate-100" />
            <div className="h-14 rounded-xl bg-slate-100" />
            <div className="h-14 rounded-xl bg-slate-100" />
          </div>
        )}

        {!jobsLoading && !hasJobs && (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center">
            <p className="text-sm font-medium text-slate-900">No live roles right now.</p>
            <p className="mt-1 text-sm text-slate-500">Get an email when a new one is published.</p>
            <button
              type="button"
              onClick={() => router.push("/alerts")}
              className="mt-4 h-10 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium"
            >
              Get alerts
            </button>
          </div>
        )}

        {!jobsLoading && hasJobs && (
          <div className="space-y-3">
            <FeaturedBoardZone count={featuredPreview.length}>
              {featuredPreview.map((job) => (
                <HomePreviewCard
                  key={job.id}
                  job={job}
                  isSaved={savedJobIds.includes(job.id)}
                  onToggleSave={() => handleToggleSave(job.id)}
                />
              ))}
            </FeaturedBoardZone>
            {previewJobs.length > 0 && (
              <div className="space-y-2">
                {featuredPreview.length > 0 && (
                  <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">Latest roles</p>
                )}
                {previewJobs.map((job) => (
                  <HomePreviewCard
                  key={job.id}
                  job={job}
                  isSaved={savedJobIds.includes(job.id)}
                  onToggleSave={() => handleToggleSave(job.id)}
                />
                ))}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => router.push("/jobs")}
          className="mt-4 w-full h-11 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-800 hover:border-slate-300 hover:bg-slate-50"
        >
          {hasJobs ? `See all ${jobs.length} jobs` : "Browse jobs"}
        </button>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => router.push("/alerts")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left hover:border-slate-300 hover:bg-slate-50"
          >
            <div className="text-sm font-semibold text-slate-900">For candidates</div>
            <p className="mt-1 text-xs text-slate-600">Email when a new role is published. Apply on the company site.</p>
          </button>
          <button
            type="button"
            onClick={() => router.push("/hire-talent")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left hover:border-slate-300 hover:bg-slate-50"
          >
            <div className="text-sm font-semibold text-slate-900">For employers</div>
            <p className="mt-1 text-xs text-slate-600">Post → review → live. Candidates apply on your link.</p>
          </button>
        </div>
      </section>
    </>
  );
}
