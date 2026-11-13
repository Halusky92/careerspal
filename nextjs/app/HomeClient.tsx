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
import PublicSubscriberNote from "../components/PublicSubscriberNote";
import { trackFunnel } from "../lib/funnelTrack";
import { homeSeeAllLabel } from "../lib/boardAccess";

const PENDING_SAVE_KEY = "cp_pending_save_job";

export default function HomeClient({
  initialJobs,
  initialLiveTotal = null,
  subscriberCount = null,
}: {
  initialJobs: Job[];
  initialLiveTotal?: number | null;
  subscriberCount?: number | null;
}) {
  const router = useRouter();
  const { accessToken, loading: authLoading } = useSupabaseAuth();
  const [jobs, setJobs] = useState<Job[]>(() => (initialJobs || []).slice(0, 4));
  const [jobsLoading, setJobsLoading] = useState(() => (initialJobs?.length ? false : true));
  const [boardAccess, setBoardAccess] = useState<"guest" | "registered" | "paid">("guest");
  const [liveTotal, setLiveTotal] = useState<number | null>(
    typeof initialLiveTotal === "number" && Number.isFinite(initialLiveTotal) ? initialLiveTotal : null,
  );
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
        const response = accessToken
          ? await authFetch("/api/jobs", {}, accessToken)
          : await fetch("/api/jobs");
        const data = (await response.json()) as {
          jobs?: Job[];
          total?: number;
          access?: "guest" | "registered" | "paid";
        };
        if (Array.isArray(data.jobs)) {
          setJobs(data.jobs);
        }
        if (typeof data.total === "number" && Number.isFinite(data.total)) {
          setLiveTotal(data.total);
        }
        if (data.access) setBoardAccess(data.access);
      } catch {
        // keep fallback
      } finally {
        setJobsLoading(false);
      }
    };
    loadJobs();
  }, [accessToken]);

  const liveJobs = useMemo(
    () =>
      [...jobs]
        .filter((job) => isOnNicheJob(job))
        .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)),
    [jobs],
  );
  const featuredPreview = useMemo(() => {
    const take = boardAccess === "paid" ? 3 : Math.min(3, liveJobs.length);
    return sortFeaturedJobs(liveJobs.filter(isPaidFeaturedListing)).slice(0, take);
  }, [liveJobs, boardAccess]);
  const previewJobs = useMemo(() => {
    const rest = liveJobs.filter((job) => !isPaidFeaturedListing(job));
    const take = 4;
    const room = Math.max(0, take - featuredPreview.length);
    return rest.slice(0, room);
  }, [liveJobs, featuredPreview.length]);

  const hasJobs = liveJobs.length > 0;

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
          {homeSeeAllLabel(hasJobs, liveTotal)}
        </button>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => router.push("/alerts")}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left hover:border-slate-300 hover:bg-slate-50"
          >
            <div className="text-sm font-semibold text-slate-900">For candidates</div>
            <p className="mt-1 text-xs text-slate-600">Email when a new role is published. Apply on the company site.</p>
            <PublicSubscriberNote count={subscriberCount} className="mt-1 text-xs text-slate-500" />
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

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col">
            <h3 className="text-base font-semibold text-slate-900">Free</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed flex-1">
              Preview up to 4 matching search results. Basic filters. Open any job page and apply on the company site. No account, alerts, or newsletter.
            </p>
            <p className="mt-5 text-3xl font-semibold tracking-tight text-slate-900">$0</p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col">
            <h3 className="text-base font-semibold text-slate-900">Free Account</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed flex-1">
              Explore up to 14 matching search results (4 + 10). One personalized weekly job alert. Weekly newsletter only if you opt in.
            </p>
            <p className="mt-5 text-3xl font-semibold tracking-tight text-slate-900">$0</p>
            <button
              type="button"
              onClick={() => {
                trackFunnel("signup_started", { from: "home_card" });
                router.push(`/auth?from=${encodeURIComponent("/")}`);
              }}
              className="mt-4 h-10 w-full rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
            >
              Create account
            </button>
          </article>

          <article className="rounded-2xl border border-indigo-600 bg-indigo-600 p-5 flex flex-col text-white shadow-sm">
            <h3 className="text-base font-semibold">Premium</h3>
            <p className="mt-2 text-sm text-indigo-100 leading-relaxed flex-1">
              Unlimited search results, advanced filters, multiple saved searches, daily alerts, and the weekly newsletter. Cancel in Stripe.
            </p>
            <p className="mt-5 text-3xl font-semibold tracking-tight">
              $7.99<span className="text-base font-medium text-indigo-200"> / month</span>
            </p>
            <button
              type="button"
              onClick={() => {
                trackFunnel("premium_click", { from: "home_card" });
                router.push(accessToken ? "/upgrade" : `/auth?from=${encodeURIComponent("/upgrade")}`);
              }}
              className="mt-4 h-10 w-full rounded-lg bg-white text-indigo-700 text-sm font-medium hover:bg-indigo-50"
            >
              Get full access
            </button>
          </article>
        </div>
      </section>
    </>
  );
}
