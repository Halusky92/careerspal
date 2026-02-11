"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PostJob from "../../components/PostJob";
import { Job, PlanType } from "../../types";
import { useSupabaseAuth } from "../../components/Providers";
import { authFetch } from "../../lib/authFetch";

const PLAN_KEY = "cp_selected_plan";

const getStoredPlan = () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PLAN_KEY);
    return raw ? (JSON.parse(raw) as { type: PlanType; price: number }) : null;
  } catch {
    return null;
  }
};

const PostJobPage = () => {
  const router = useRouter();
  const { profile, accessToken, loading: authLoading } = useSupabaseAuth();
  const [selectedPlan, setSelectedPlan] = useState<{ type: PlanType; price: number }>(() => {
    return getStoredPlan() || { type: "Standard", price: 79 };
  });
  const [showTestPlan, setShowTestPlan] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!profile?.email) {
      router.replace("/auth?role=employer&from=/post-a-job");
      return;
    }
    if (profile.role && profile.role !== "employer" && profile.role !== "admin") {
      router.replace("/dashboard/candidate");
    }
  }, [authLoading, profile, router]);

  if (authLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <div className="inline-flex items-center gap-3 text-slate-500 font-bold">
          <span className="h-3 w-3 rounded-full bg-indigo-500 animate-pulse"></span>
          Loading employer console...
        </div>
      </div>
    );
  }

  useEffect(() => {
    sessionStorage.setItem(PLAN_KEY, JSON.stringify(selectedPlan));
    try {
      sessionStorage.removeItem("cp_test_plan_price");
      if (profile?.role === "admin" && showTestPlan && selectedPlan.type === "Standard" && selectedPlan.price === 1) {
        sessionStorage.setItem("cp_admin_internal_plan", "1");
      } else {
        sessionStorage.removeItem("cp_admin_internal_plan");
      }
    } catch {
      // ignore
    }
  }, [selectedPlan, profile?.role, showTestPlan]);

  useEffect(() => {
    const checkTestPlanAccess = async () => {
      if (!accessToken || profile?.role !== "admin") {
        setShowTestPlan(false);
        return;
      }
      try {
        const response = await authFetch("/api/admin/test-plan-access", {}, accessToken);
        if (!response.ok) {
          setShowTestPlan(false);
          return;
        }
        const data = (await response.json()) as { allowed?: boolean };
        setShowTestPlan(Boolean(data.allowed));
      } catch {
        setShowTestPlan(false);
      }
    };
    checkTestPlanAccess();
  }, [accessToken, profile?.role]);

  const handleJobSubmission = async (data: Job) => {
    const storagePlanPrice = Number.isFinite(selectedPlan.price)
      ? selectedPlan.price < 1
        ? 1
        : Math.round(selectedPlan.price)
      : 79;
    const finalJobData = { ...data, plan: selectedPlan, planType: selectedPlan.type, status: "draft" };
    sessionStorage.setItem("cp_pending_job", JSON.stringify(finalJobData));

    try {
      if (!accessToken) throw new Error("Missing auth");
      const response = await authFetch(
        "/api/employer/jobs",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...finalJobData,
            plan: { ...selectedPlan, price: storagePlanPrice },
            planPrice: storagePlanPrice,
            adminInternalPlan: profile?.role === "admin" && showTestPlan && selectedPlan.type === "Standard" && selectedPlan.price === 1,
          }),
        },
        accessToken,
      );
      const payload = (await response.json()) as { job?: Job };
      if (payload.job?.id) {
        sessionStorage.setItem("cp_pending_job_id", payload.job.id);
        router.push(`/checkout?jobId=${payload.job.id}`);
        return;
      }
    } catch {
      // fallback to checkout without server id
    }

    router.push("/checkout");
  };

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
      <PostJob
        onComplete={handleJobSubmission}
        selectedPlan={selectedPlan}
        onUpgradePlan={(type, price) => setSelectedPlan({ type, price })}
        showTestPlan={showTestPlan}
      />
    </div>
  );
};

export default PostJobPage;
