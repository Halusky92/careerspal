"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

const PostJobPageInner = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editJobId = searchParams.get("jobId");
  const { profile, accessToken, loading: authLoading, refreshProfile } = useSupabaseAuth();
  const [foundingEligible, setFoundingEligible] = useState(false);
  const [initialJob, setInitialJob] = useState<Partial<Job> | undefined>(undefined);
  const [selectedPlan, setSelectedPlan] = useState<{ type: PlanType; price: number }>(() => {
    return getStoredPlan() || { type: "Standard", price: 79 };
  });
  const [showTestPlan, setShowTestPlan] = useState(false);

  // Ensure the admin-only $1 plan never leaks to non-admins via sessionStorage.
  useEffect(() => {
    const isAdmin = profile?.role === "admin";
    const isInternalPrice = selectedPlan.type === "Standard" && selectedPlan.price <= 5;
    if (!isInternalPrice) return;
    if (foundingEligible && selectedPlan.type === "Standard" && selectedPlan.price === 1) return;

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
  }, [profile?.role, selectedPlan.price, selectedPlan.type, showTestPlan, foundingEligible]);

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

  useEffect(() => {
    const load = async () => {
      if (!accessToken) return;
      try {
        const foundingRes = await authFetch("/api/employer/founding", {}, accessToken);
        if (foundingRes.ok) {
          const data = (await foundingRes.json()) as { eligible?: boolean };
          setFoundingEligible(Boolean(data.eligible));
        }
        if (editJobId) {
          const jobRes = await authFetch(`/api/employer/jobs/${editJobId}`, {}, accessToken);
          if (jobRes.ok) {
            const data = (await jobRes.json()) as { job?: Job };
            if (data.job) setInitialJob(data.job);
          }
        }
      } catch {
        // ignore
      }
    };
    load();
  }, [accessToken, editJobId]);

  useEffect(() => {
    if (!foundingEligible) return;
    if (selectedPlan.type !== "Standard") return;
    setSelectedPlan({ type: "Standard", price: 1 });
  }, [foundingEligible, selectedPlan.type]);

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
        const roleResp = await authFetch(
          "/api/account/role",
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: "employer" }),
          },
          accessToken,
        );
        if (!roleResp.ok) {
          router.push(`/auth?role=employer&from=${encodeURIComponent("/checkout")}`);
          return;
        }
        await refreshProfile();
      } catch {
        router.push(`/auth?role=employer&from=${encodeURIComponent("/checkout")}`);
        return;
      }
    }

    try {
      if (!accessToken) throw new Error("Missing auth");
      if (editJobId) {
        const update = await authFetch(
          `/api/employer/jobs/${editJobId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: finalJobData.title,
              description: finalJobData.description,
              location: finalJobData.location,
              remotePolicy: finalJobData.remotePolicy,
              type: finalJobData.type,
              salary: finalJobData.salary,
              applyUrl: finalJobData.applyUrl,
              companyWebsite: finalJobData.companyWebsite,
              keywords: finalJobData.keywords,
            }),
          },
          accessToken,
        );
        if (update.ok) {
          router.push("/dashboard/employer");
          return;
        }
      }
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
      const payload = (await response.json()) as { job?: Job; claimRequired?: boolean; error?: string };
      if (payload.claimRequired) {
        router.push("/dashboard/employer");
        return;
      }
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
        key={initialJob?.id || "new"}
        onComplete={handleJobSubmission}
        selectedPlan={selectedPlan}
        onUpgradePlan={(type, price) => setSelectedPlan({ type, price })}
        showTestPlan={showTestPlan}
        foundingEligible={foundingEligible}
        initialJob={initialJob}
      />
    </div>
  );
};

const PostJobPage = () => (
  <Suspense fallback={<div className="py-24 text-center text-slate-500 font-bold">Loading…</div>}>
    <PostJobPageInner />
  </Suspense>
);

export default PostJobPage;
