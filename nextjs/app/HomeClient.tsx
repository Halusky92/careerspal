'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Hero from "../components/Hero";
import HomePreviewCard from "../components/HomePreviewCard";
import { Job } from "../types";
import { isOnNicheJob } from "../lib/nicheScope";
import { isPaidFeaturedListing, sortFeaturedJobs } from "../lib/featuredListing";
import { isPriorityListing } from "../lib/listingWindow";
import { acceptHomeResponse, homeViewerTier, jobsForHomeViewer, nextHomeSync, type HomeSync } from "../lib/homeBoardSync";
import FeaturedBoardZone from "../components/FeaturedBoardZone";
import { useSupabaseAuth } from "../components/Providers";
import { authFetch } from "../lib/authFetch";
import PublicSubscriberNote from "../components/PublicSubscriberNote";
import { trackFunnel } from "../lib/funnelTrack";
import { homeSeeAllLabel } from "../lib/boardAccess";
import PlanComparison from "../components/PlanComparison";
import EmployerFlipGrid from "../components/EmployerFlipGrid";
import type { HiringEmployer } from "../lib/companyBoard";

function homePlan(
  authLoading: boolean,
  signedIn: boolean,
  profile: { role?: string | null; premiumUntil?: string | null; subscriptionStatus?: string | null } | null,
  boardAccess: "guest" | "registered" | "paid",
): "guest" | "account" | "premium" | null {
  if (authLoading) return null;
  if (profile?.role === "admin" || boardAccess === "paid") return "premium";
  const status = profile?.subscriptionStatus || "";
  const until = profile?.premiumUntil ? Date.parse(profile.premiumUntil) : 0;
  const paid =
    status === "active" ||
    status === "trialing" ||
    status === "past_due" ||
    (Number.isFinite(until) && until > Date.now());
  if (paid) return "premium";
  if (signedIn || boardAccess === "registered") return "account";
  return "guest";
}

const PENDING_SAVE_KEY = "cp_pending_save_job";

export default function HomeClient({
  initialJobs,
  initialLiveTotal = null,
  initialAccess = "guest",
  subscriberCount = null,
  employers = [],
}: {
  initialJobs: Job[];
  initialLiveTotal?: number | null;
  initialAccess?: "guest" | "registered" | "paid";
  subscriberCount?: number | null;
  employers?: HiringEmployer[];
}) {
  const router = useRouter();
  const { accessToken, loading: authLoading, profile } = useSupabaseAuth();
  const [jobs, setJobs] = useState<Job[]>(() => initialJobs || []);
  const [jobsLoading, setJobsLoading] = useState(() => (initialJobs?.length ? false : true));
  const [liveTotal, setLiveTotal] = useState<number | null>(
    typeof initialLiveTotal === "number" && Number.isFinite(initialLiveTotal) ? initialLiveTotal : null,
  );
  const [savedJobIds, setSavedJobIds] = useState<string[]>([]);
  const syncRef = useRef<HomeSync>({ tier: null, request: 0 });
  const tier = authLoading ? initialAccess : homeViewerTier(accessToken, profile);

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
    if (authLoading) return;
    const decision = nextHomeSync(syncRef.current, tier, initialAccess);
    syncRef.current = decision.sync;
    if (!decision.fetch) return;
    const request = decision.sync.request;
    const requestedTier = tier;
    const controller = new AbortController();
    const loadJobs = async () => {
      try {
        const response = requestedTier === "guest"
          ? await fetch("/api/jobs", { signal: controller.signal, credentials: "omit", cache: "no-store" })
          : await authFetch("/api/jobs", { signal: controller.signal }, accessToken);
        const data = (await response.json()) as {
          jobs?: Job[];
          total?: number;
          access?: "guest" | "registered" | "paid";
        };
        if (!acceptHomeResponse(syncRef.current, request, requestedTier)) return;
        const access = data.access === "paid" || data.access === "registered" || data.access === "guest" ? data.access : requestedTier;
        const visibleTier = syncRef.current.tier ?? requestedTier;
        if (Array.isArray(data.jobs)) {
          setJobs(visibleTier === "paid" && access === "paid" ? data.jobs : jobsForHomeViewer(data.jobs, visibleTier === "paid" ? access : visibleTier));
        }
        if (typeof data.total === "number" && Number.isFinite(data.total) && access === visibleTier) setLiveTotal(data.total);
      } catch {
        // A newer sign-in or sign-out owns the list.
      } finally {
        if (acceptHomeResponse(syncRef.current, request, requestedTier)) setJobsLoading(false);
      }
    };
    loadJobs();
    return () => controller.abort();
  }, [accessToken, authLoading, initialAccess, tier]);

  const liveJobs = useMemo(
    () =>
      jobsForHomeViewer(
        [...jobs]
          .filter((job) => isOnNicheJob(job))
          .sort((a, b) => {
            const priority = Number(isPriorityListing(b)) - Number(isPriorityListing(a));
            if (priority !== 0) return priority;
            return (b.timestamp ?? 0) - (a.timestamp ?? 0);
          }),
        tier,
      ),
    [jobs, tier],
  );
  const featuredPreview = useMemo(() => {
    const take = tier === "paid" ? 3 : Math.min(3, liveJobs.length);
    return sortFeaturedJobs(liveJobs.filter(isPaidFeaturedListing)).slice(0, take);
  }, [liveJobs, tier]);
  const previewJobs = useMemo(() => {
    const rest = liveJobs.filter((job) => !isPaidFeaturedListing(job));
    const take = 4;
    const room = Math.max(0, take - featuredPreview.length);
    return rest.slice(0, room);
  }, [liveJobs, featuredPreview.length]);

  const hasJobs = liveJobs.length > 0;
  const plan = homePlan(authLoading, Boolean(accessToken), profile, tier);

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

        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={() => router.push("/jobs")}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm hover:border-slate-400 hover:bg-slate-50"
          >
            {homeSeeAllLabel(hasJobs, liveTotal)}
            <span aria-hidden="true">→</span>
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => router.push("/alerts")}
            className="rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-left shadow-sm hover:border-slate-400 hover:bg-slate-50"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                  <circle cx="12" cy="8" r="3.25" />
                  <path d="M5.5 19.25v-.5a4.5 4.5 0 0 1 4.5-4.5h4a4.5 4.5 0 0 1 4.5 4.5v.5" strokeLinecap="round" />
                </svg>
              </span>
              <div className="text-sm font-semibold text-slate-900">For candidates</div>
            </div>
            <p className="mt-2 text-sm leading-5 text-slate-600">Browse the board and apply on the company site. An account keeps one saved search.</p>
            <PublicSubscriberNote count={subscriberCount} className="mt-1.5 text-xs text-slate-500" />
          </button>
          <button
            type="button"
            onClick={() => router.push("/hire-talent")}
            className="rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-left shadow-sm hover:border-slate-400 hover:bg-slate-50"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                  <rect x="3.5" y="7.5" width="17" height="12" rx="2" />
                  <path d="M9 7.5V6.25A2.25 2.25 0 0 1 11.25 4h1.5A2.25 2.25 0 0 1 15 6.25V7.5" strokeLinecap="round" />
                  <path d="M3.5 12.5h17" />
                </svg>
              </span>
              <div className="text-sm font-semibold text-slate-900">For employers</div>
            </div>
            <p className="mt-2 text-sm leading-5 text-slate-600">After review, a role is on Premium for 24 hours, then public. Candidates apply on your link.</p>
          </button>
        </div>

        <div className="mt-8">
          {plan === null ? (
            <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
          ) : (
            <PlanComparison
              current={plan}
              memberName={profile?.name}
              onCreateAccount={() => {
                trackFunnel("signup_started", { from: "home_card" });
                router.push(`/auth?from=${encodeURIComponent("/")}`);
              }}
              onGetPremium={() => {
                trackFunnel("premium_click", { from: "home_card" });
                router.push(accessToken ? "/upgrade" : `/auth?from=${encodeURIComponent("/upgrade")}`);
              }}
            />
          )}
          <EmployerFlipGrid employers={employers} />
        </div>
      </section>
    </>
  );
}
