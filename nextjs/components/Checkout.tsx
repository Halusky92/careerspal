"use client";


import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from "next/navigation";
import { Job } from '../types';
import { useSupabaseAuth } from "./Providers";
import { authFetch } from "../lib/authFetch";

interface CheckoutProps {
  jobData: Job | null;
  jobId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const Checkout: React.FC<CheckoutProps> = ({ jobData, jobId, onSuccess, onCancel }) => {
  const router = useRouter();
  const [step, setStep] = useState<'form' | 'processing' | 'success'>('form');
  const [error, setError] = useState<string | null>(null);
  const { accessToken, profile, loading: authLoading, refreshProfile } = useSupabaseAuth();
  const [ownershipRecoveryAttempted, setOwnershipRecoveryAttempted] = useState(false);

  if (!jobData) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Missing job details</h2>
        <p className="text-slate-500 font-medium mb-8">Please return and complete the job submission first.</p>
        <button onClick={onCancel} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-semibold">
          Back to Form
        </button>
      </div>
    );
  }

  const [overridePrice, setOverridePrice] = useState<number | null>(null);
  const price = (overridePrice ?? jobData?.plan?.price) || 79;
  const planName = jobData?.plan?.type || 'Standard';
  const formatPrice = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
  const storagePlanPrice = Number.isFinite(price) ? (price < 1 ? 1 : Math.round(price)) : 79;

  const authRedirectUrl = useMemo(() => {
    const from = jobId ? `/checkout?jobId=${encodeURIComponent(jobId)}` : "/checkout";
    return `/auth?role=employer&from=${encodeURIComponent(from)}`;
  }, [jobId]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("cp_test_plan_price");
      if (!raw) return;
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0 && parsed < 1) {
        setOverridePrice(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  const handlePay = async () => {
    if (authLoading) {
      setError("Preparing session…");
      setStep("form");
      return;
    }

    const hasAccess = Boolean(accessToken);
    if (!hasAccess) {
      router.push(authRedirectUrl);
      return;
    }

    // If user is signed in but role is not employer/admin (or profile not loaded yet),
    // upgrade role to employer so they can create/pay for a listing.
    const currentRole = profile?.role || null;
    const roleOk = currentRole === "employer" || currentRole === "admin";
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
          setError("Please sign in as an employer to continue.");
          setStep("form");
          return;
        }
        await refreshProfile();
      } catch {
        router.push(authRedirectUrl);
        return;
      }
    }

    setStep('processing');

    try {
      const readJson = async <T,>(response: Response): Promise<T | null> => {
        const text = await response.text();
        if (!text) return null;
        try {
          return JSON.parse(text) as T;
        } catch {
          return { error: text } as T;
        }
      };
      let adminInternalPlan = false;
      try {
        adminInternalPlan = sessionStorage.getItem("cp_admin_internal_plan") === "1";
      } catch {
        adminInternalPlan = false;
      }
      let effectiveJobId = jobId;
      if (!effectiveJobId && jobData?.id && !jobData.id.startsWith("local-")) {
        effectiveJobId = jobData.id;
      }

      if (!effectiveJobId) {
        if (!accessToken) {
          router.push(authRedirectUrl);
          return;
        }
        const createResponse = await authFetch(
          "/api/employer/jobs",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...jobData,
              plan: jobData?.plan ? { ...jobData.plan, price: storagePlanPrice } : jobData?.plan,
              planPrice: storagePlanPrice,
              status: jobData?.status || "draft",
            }),
          },
          accessToken,
        );
        const created = (await readJson<{ job?: Job; error?: string }>(createResponse)) || {};
        if (!createResponse.ok || !created.job?.id) {
          setError(created.error || "Failed to create the listing.");
          setStep("form");
          return;
        }
        effectiveJobId = created.job.id;
        try {
          sessionStorage.setItem("cp_pending_job_id", effectiveJobId);
        } catch {
          // ignore
        }
      }

      const response = await authFetch(
        "/api/stripe/checkout",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: effectiveJobId, price, planName, adminInternalPlan }),
        },
        accessToken,
      );
      const data = (await readJson<{ url?: string; error?: string }>(response)) || {};
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      if (response.status === 401) {
        router.push(authRedirectUrl);
        return;
      }
      if (response.status === 403) {
        const message = data.error || "You don’t have permission to pay for this listing. Please resubmit the role.";
        const looksLikeOwnershipMismatch =
          message.toLowerCase().includes("different account") ||
          message.toLowerCase().includes("linked to a different account");

        // Recovery: if a stale/shared jobId is linked to a different account, recreate the listing under the
        // currently signed-in employer and retry checkout once.
        if (looksLikeOwnershipMismatch && !ownershipRecoveryAttempted && accessToken) {
          setOwnershipRecoveryAttempted(true);
          try {
            const createResponse = await authFetch(
              "/api/employer/jobs",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...jobData,
                  plan: jobData?.plan ? { ...jobData.plan, price: storagePlanPrice } : jobData?.plan,
                  planPrice: storagePlanPrice,
                  status: jobData?.status || "draft",
                }),
              },
              accessToken,
            );
            const created = (await readJson<{ job?: Job; error?: string }>(createResponse)) || {};
            if (!createResponse.ok || !created.job?.id) {
              setError(created.error || "Could not link the listing to your account. Please resubmit the role.");
              setStep("form");
              return;
            }
            const recoveredJobId = created.job.id;
            try {
              sessionStorage.setItem("cp_pending_job_id", recoveredJobId);
            } catch {
              // ignore
            }

            const retryResponse = await authFetch(
              "/api/stripe/checkout",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jobId: recoveredJobId, price, planName, adminInternalPlan }),
              },
              accessToken,
            );
            const retryData = (await readJson<{ url?: string; error?: string }>(retryResponse)) || {};
            if (retryData?.url) {
              window.location.href = retryData.url;
              return;
            }
            if (retryResponse.status === 401) {
              router.push(authRedirectUrl);
              return;
            }
            setError(retryData.error || `Failed to start checkout (status ${retryResponse.status}).`);
            setStep("form");
            return;
          } catch {
            setError("Could not link the listing to your account. Please resubmit the role.");
            setStep("form");
            return;
          }
        }

        setError(message);
        setStep("form");
        return;
      }
      setError(data.error || `Failed to start checkout (status ${response.status}).`);
      setStep("form");
    } catch {
      setError("Failed to start checkout.");
      setStep("form");
    }
  };

  if (step === 'success') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center animate-in zoom-in-95 duration-500">
        <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-10 text-4xl shadow-xl">✓</div>
        <h1 className="text-5xl font-bold text-slate-900 mb-6 tracking-tight">Payment Successful!</h1>
        <p className="text-lg text-slate-500 mb-2 font-medium">The role &quot;{jobData?.title}&quot; has been successfully activated.</p>
        <p className="text-sm text-slate-600 font-medium mb-12">Confirmation sent to your email. Matches sent to subscribers.</p>
        <button onClick={onSuccess} className="bg-indigo-600 text-white px-10 py-5 rounded-3xl font-semibold text-xl shadow-xl hover:scale-105 transition-all">Go to Dashboard</button>
      </div>
    );
  }

  if (step === 'processing') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center flex flex-col items-center animate-in fade-in">
        <div className="w-20 h-20 border-4 border-indigo-50 border-t-indigo-600 rounded-full animate-spin mb-10"></div>
        <h2 className="text-3xl font-bold text-slate-900 mb-4 tracking-tight">Processing Payment...</h2>
        <p className="text-slate-600 font-medium uppercase tracking-wide text-xs">Matching with Talent Pool...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 animate-in fade-in slide-in-from-bottom-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        <div className="lg:col-span-7 bg-white p-10 sm:p-14 rounded-[3.5rem] shadow-2xl border border-slate-50">
          <div className="flex items-center gap-4 mb-10">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
            </div>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight leading-none">Checkout</h2>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Secure payment</p>
              <p className="mt-3 text-sm font-bold text-slate-700">
                You will complete payment securely on Stripe.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handlePay}
                className="w-full bg-indigo-600 text-white font-semibold py-6 rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all text-xl active:scale-[0.98]"
              >
                Continue to Stripe ({formatPrice(price)})
              </button>
              {error && (
                <p className="text-center text-red-500 text-sm font-bold mt-4">{error}</p>
              )}
              <button
                type="button"
                onClick={onCancel}
                className="w-full text-slate-600 font-medium mt-6 hover:text-slate-900 transition-colors"
              >
                Cancel & Return
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-8 sticky top-28">
           <div className="bg-slate-900 p-10 rounded-[3.5rem] text-white shadow-2xl">
              <h3 className="text-xl font-bold mb-8 border-b border-white/10 pb-6">Order Summary</h3>
              <div className="space-y-6">
                 <div className="flex justify-between items-center">
                    <div>
                       <p className="font-semibold text-white">{jobData?.title || "New Listing"}</p>
                       <p className="text-[10px] text-slate-300 font-medium uppercase tracking-wide">{planName} 30-Day Listing</p>
                    </div>
                    <span className="font-semibold">{formatPrice(price)}</span>
                 </div>
                 <div className="pt-6 border-t border-white/10 flex justify-between items-center">
                    <span className="text-lg font-semibold uppercase tracking-wide text-slate-300">Total</span>
                    <span className="text-3xl font-bold text-indigo-400">{formatPrice(price)}</span>
                 </div>
              </div>
           </div>

           <div className="bg-white p-8 rounded-[2.5rem] flex items-start gap-4 border border-indigo-100 shadow-sm">
              <span className="text-2xl">🛡️</span>
              <p className="text-xs font-bold text-slate-500 leading-relaxed">
                 All payments are encrypted via CareersPal Secure Gateway. Admin notifications are instant.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
