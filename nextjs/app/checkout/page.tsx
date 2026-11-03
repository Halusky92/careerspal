"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Checkout from "../../components/Checkout";
import { Job } from "../../types";
import { useSupabaseAuth } from "../../components/Providers";
import { authFetch } from "../../lib/authFetch";

const CheckoutPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pendingJob, setPendingJob] = useState<Job | null>(null);
  const [resolvedJobId, setResolvedJobId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const jobId = searchParams.get("jobId");
  const { accessToken } = useSupabaseAuth();

  useEffect(() => {
    const loadJob = async () => {
      let effectiveJobId = jobId;
      if (!effectiveJobId) {
        try {
          const storedId = sessionStorage.getItem("cp_pending_job_id");
          if (storedId) effectiveJobId = storedId;
        } catch {
          // ignore
        }
      }
      if (effectiveJobId) {
        setResolvedJobId(effectiveJobId);
      }
      try {
        if (effectiveJobId) {
          let response: Response | null = null;
          if (accessToken) {
            response = await authFetch(`/api/employer/jobs/${effectiveJobId}`, {}, accessToken);
          }
          if (!response || !response.ok) {
            response = await fetch(`/api/jobs/${effectiveJobId}`);
          }
          if (response.ok) {
            const data = (await response.json()) as { job?: Job };
            if (data.job) {
              let merged = data.job;
              try {
                const raw = sessionStorage.getItem("cp_pending_job");
                if (raw) {
                  const stored = JSON.parse(raw) as Job;
                  merged = {
                    ...stored,
                    ...data.job,
                    plan: data.job.plan || stored.plan,
                  };
                }
              } catch {
                // ignore
              }
              setPendingJob(merged);
              setIsLoading(false);
              return;
            }
          }
        }
      } catch {
        // fallback below
      }

      try {
        const raw = sessionStorage.getItem("cp_pending_job");
        if (raw) {
          setPendingJob(JSON.parse(raw));
        }
      } catch {
        setPendingJob(null);
      } finally {
        setIsLoading(false);
      }
    };
    loadJob();
  }, [jobId, accessToken]);

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <div className="inline-flex items-center gap-3 text-slate-500 font-bold">
          <span className="h-3 w-3 rounded-full bg-indigo-500 animate-pulse"></span>
          Preparing checkout...
        </div>
      </div>
    );
  }

  if (!pendingJob) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600"
        >
          <span>← Back</span>
        </button>
        <h1 className="text-3xl font-black text-slate-900 mt-6">No listing selected</h1>
        <p className="text-slate-500 font-medium mt-3">
          Pick a plan and submit a role before checking out.
        </p>
        <button
          onClick={() => router.push("/post-a-job")}
          className="mt-8 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700"
        >
          Go to Post a Job
        </button>
      </div>
    );
  }

  return (
    <div className="pt-6">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600"
        >
          <span>← Back</span>
        </button>
      </div>
      <Checkout
        jobData={pendingJob}
        jobId={resolvedJobId || undefined}
        onCancel={() => router.push("/post-a-job")}
        onSuccess={() => router.push("/dashboard/employer")}
      />
    </div>
  );
};

export default CheckoutPage;
