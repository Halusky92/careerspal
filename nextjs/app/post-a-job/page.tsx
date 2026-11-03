"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PostJob from "../../components/PostJob";
import { Job, PlanType } from "../../types";
import { useSupabaseAuth } from "../../components/Providers";
import { authFetch } from "../../lib/authFetch";
import { PLAN_PRICES } from "../../lib/plans";
import type { StartPackStatus } from "../../lib/founding";
import {
  postingOwnerKey,
  readPostingItem,
  removePostingItem,
  writePostingItem,
} from "../../lib/postingSession";

const PLAN_KEY = "cp_selected_plan";

const getStoredPlan = (owner: string) => {
  if (typeof window === "undefined") return null;
  try {
    const raw = readPostingItem(PLAN_KEY, owner);
    return raw ? (JSON.parse(raw) as { type: PlanType; price: number }) : null;
  } catch {
    return null;
  }
};

const PostJobPageInner = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editJobId = searchParams.get("jobId");
  const { user, profile, accessToken, loading: authLoading, refreshProfile } = useSupabaseAuth();
  const owner = postingOwnerKey(user?.id, profile?.email);
  const [foundingEligible, setFoundingEligible] = useState(false);
  const [foundingLoaded, setFoundingLoaded] = useState(false);
  const [foundingStatus, setFoundingStatus] = useState<StartPackStatus | null>(null);
  const [initialJob, setInitialJob] = useState<Partial<Job> | undefined>(undefined);
  const [selectedPlan, setSelectedPlan] = useState<{ type: PlanType; price: number }>({
    type: "Standard",
    price: PLAN_PRICES.standard,
  });
  const [showTestPlan, setShowTestPlan] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Ensure the admin-only $1 plan never leaks to non-admins via sessionStorage.
  // Price 0 is Start pack, not the $1 test plan.
  useEffect(() => {
    const isAdmin = profile?.role === "admin";
    const isInternalPrice = selectedPlan.type === "Standard" && selectedPlan.price === 1;
    if (!isInternalPrice) return;
    if (!(isAdmin && showTestPlan)) {
      setSelectedPlan(
        foundingEligible
          ? { type: "Standard", price: 0 }
          : { type: "Standard", price: PLAN_PRICES.standard },
      );
      removePostingItem("cp_admin_internal_plan", owner);
    }
  }, [profile?.role, selectedPlan.price, selectedPlan.type, showTestPlan, foundingEligible, owner]);

  useEffect(() => {
    if (authLoading) return;
    const stored = getStoredPlan(owner);
    if (stored?.type) setSelectedPlan(stored);
  }, [authLoading, owner]);

  useEffect(() => {
    if (authLoading) return;
    writePostingItem(PLAN_KEY, owner, JSON.stringify(selectedPlan));
    removePostingItem("cp_test_plan_price", owner);
    if (profile?.role === "admin" && showTestPlan && selectedPlan.type === "Standard" && selectedPlan.price === 1) {
      writePostingItem("cp_admin_internal_plan", owner, "1");
    } else {
      removePostingItem("cp_admin_internal_plan", owner);
    }
  }, [selectedPlan, profile?.role, showTestPlan, owner, authLoading]);

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
      if (!accessToken) {
        setFoundingEligible(false);
        setFoundingStatus(null);
        setFoundingLoaded(true);
        return;
      }
      setFoundingLoaded(false);
      try {
        const foundingRes = await authFetch("/api/employer/founding", {}, accessToken);
        if (foundingRes.ok) {
          const data = (await foundingRes.json()) as StartPackStatus;
          setFoundingStatus(data);
          setFoundingEligible(Boolean(data.eligible));
        } else {
          setFoundingEligible(false);
          setFoundingStatus(null);
        }
        if (editJobId) {
          const jobRes = await authFetch(`/api/employer/jobs/${editJobId}`, {}, accessToken);
          if (jobRes.ok) {
            const data = (await jobRes.json()) as { job?: Job };
            if (data.job) setInitialJob(data.job);
          }
        }
      } catch {
        setFoundingEligible(false);
      } finally {
        setFoundingLoaded(true);
      }
    };
    load();
  }, [accessToken, editJobId, profile?.email]);

  useEffect(() => {
    if (!foundingLoaded) return;
    if (selectedPlan.type !== "Standard") return;
    if (selectedPlan.price === 1) return;
    if (foundingEligible && selectedPlan.price !== 0) {
      setSelectedPlan({ type: "Standard", price: 0 });
      return;
    }
    if (!foundingEligible && selectedPlan.price === 0) {
      setSelectedPlan({ type: "Standard", price: PLAN_PRICES.standard });
    }
  }, [foundingLoaded, foundingEligible, selectedPlan.type, selectedPlan.price]);

  const handleJobSubmission = async (data: Job) => {
    if (submitting) return;
    setSubmitting(true);
    const useStartPack = Boolean(foundingEligible && selectedPlan.type === "Standard" && selectedPlan.price !== 1);
    const storagePlanPrice = useStartPack
      ? 0
      : Number.isFinite(selectedPlan.price)
        ? Math.max(0, Math.round(selectedPlan.price))
        : 79;
    const finalJobData = { ...data, plan: selectedPlan, planType: selectedPlan.type, status: "draft" };
    writePostingItem("cp_pending_job", owner, JSON.stringify(finalJobData));

    setSubmitError("");
    if (authLoading || !accessToken) {
      setSubmitting(false);
      router.push(`/auth?role=employer&from=${encodeURIComponent("/post-a-job")}`);
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
          setSubmitting(false);
          router.push(`/auth?role=employer&from=${encodeURIComponent("/post-a-job")}`);
          return;
        }
        await refreshProfile();
      } catch {
        setSubmitting(false);
        router.push(`/auth?role=employer&from=${encodeURIComponent("/post-a-job")}`);
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
        writePostingItem("cp_pending_job_id", owner, payload.job.id);
        if (useStartPack) {
          const submit = await authFetch(`/api/employer/jobs/${payload.job.id}/submit`, { method: "POST" }, accessToken);
          if (submit.ok) {
            router.push("/dashboard/employer");
            return;
          }
          const submitPayload = (await submit.json()) as { error?: string; checkoutRequired?: boolean };
          if (!submitPayload.checkoutRequired) {
            setSubmitError(submitPayload.error || "Could not submit the Start pack listing.");
            setSubmitting(false);
            return;
          }
        }
        if (storagePlanPrice === 0) {
          setSubmitError("Start pack could not be applied. Choose a paid plan or try again.");
          setSubmitting(false);
          return;
        }
        router.push(`/checkout?jobId=${payload.job.id}`);
        return;
      }
      setSubmitError(payload.error || "Could not create the listing.");
      setSubmitting(false);
      return;
    } catch {
      setSubmitError("Could not create the listing. Try again.");
      setSubmitting(false);
      return;
    }
  };

  return (
    <div className="pt-3 pb-8">
      <PostJob
        key={initialJob?.id || "new"}
        onComplete={handleJobSubmission}
        selectedPlan={selectedPlan}
        onUpgradePlan={(type, price) => setSelectedPlan({ type, price })}
        showTestPlan={showTestPlan}
        foundingEligible={foundingEligible}
        foundingStatus={foundingStatus}
        initialJob={initialJob}
        submitting={submitting}
        submitError={submitError}
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
