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
  const { profile, accessToken, loading: authLoading, refreshProfile } = useSupabaseAuth();
  const [selectedPlan, setSelectedPlan] = useState<{ type: PlanType; price: number }>(() => {
    return getStoredPlan() || { type: "Standard", price: 79 };
  });
  const [showTestPlan, setShowTestPlan] = useState(false);

  // Ensure the admin-only $1 plan never leaks to non-admins via sessionStorage.
  useEffect(() => {
    const isAdmin = profile?.role === "admin";
    const isInternalPrice = selectedPlan.type === "Standard" && selectedPlan.price <= 5;
    if (!isInternalPrice) return;

    // Only allow internal cheap pricing when the backend explicitly allowlists the admin.
    if (!(isAdmin && showTestPlan)) {
      setSelectedPlan({ type: "Standard", price: 79 });
      try {
        sessionStorage.setItem(PLAN_KEY, JSON.stringify({ type: "Standard", price: 79 }));
        sessionStorage.removeItem("cp_admin_internal_plan");
      } catch {
        // ignore
      }
    }
  }, [profile?.role, selectedPlan.price, selectedPlan.type, showTestPlan]);

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

    if (authLoading || !accessToken) {
      router.push(`/auth?role=employer&from=${encodeURIComponent("/checkout")}`);
      return;
    }

    const role = profile?.role || null;
    const roleOk = role === "employer" || role === "admin";
    if (!roleOk) {
      try {
        await authFetch(
          "/api/account/role",
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: "employer" }),
          },
          accessToken,
        );
        await refreshProfile();
      } catch {
        router.push(`/auth?role=employer&from=${encodeURIComponent("/checkout")}`);
        return;
      }
    }

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
