"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import CandidateDashboard from "../../../components/CandidateDashboard";
import { Job, UserSession } from "../../../types";
import { useSupabaseAuth } from "../../../components/Providers";
import { authFetch } from "../../../lib/authFetch";

const CandidateDashboardPage = () => {
  const router = useRouter();
  const { profile, accessToken, loading: authLoading } = useSupabaseAuth();
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [user, setUser] = useState<UserSession | null>(null);

  const getSavedJobIds = () => {
    try {
      const raw = localStorage.getItem("cp_saved_jobs");
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  };

  const loadSavedFromApi = async () => {
    try {
      if (!accessToken) return null;
      const response = await authFetch("/api/saved-jobs", {}, accessToken);
      if (!response.ok) return null;
      const data = (await response.json()) as { savedJobs?: { jobId: string }[] };
      return data.savedJobs?.map((item) => item.jobId) || [];
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const run = async () => {
      try {
        if (authLoading) return;
        if (!profile?.email) {
          router.replace("/auth");
          return;
        }
        if (profile.role === "admin") {
          router.replace("/dashboard/admin");
          return;
        }
        if (profile.role === "employer") {
          router.replace("/dashboard/employer");
          return;
        }
        const savedFromApi = await loadSavedFromApi();
        setUser({
          email: profile.email,
          role: "candidate",
          savedJobIds: savedFromApi ?? getSavedJobIds(),
        });
      } catch {
        router.replace("/auth");
      }
    };
    run();
  }, [authLoading, profile, router, accessToken]);

  if (authLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <div className="inline-flex items-center gap-3 text-slate-500 font-bold">
          <span className="h-3 w-3 rounded-full bg-indigo-500 animate-pulse"></span>
          Loading dashboard...
        </div>
      </div>
    );
  }

  useEffect(() => {
    const loadJobs = async () => {
      try {
        const response = await fetch("/api/jobs");
        const data = (await response.json()) as { jobs?: typeof allJobs };
        if (Array.isArray(data.jobs)) {
          setAllJobs(data.jobs);
        }
      } catch {
        // fallback
      }
    };
    loadJobs();
  }, []);

  return (
    <div className="pt-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600"
        >
          <span>← Back</span>
        </button>
      </div>
      <CandidateDashboard onBrowse={() => router.push("/jobs")} user={user} allJobs={allJobs} />
    </div>
  );
};

export default CandidateDashboardPage;
