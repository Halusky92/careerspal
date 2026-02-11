"use client";


import React, { useEffect, useState } from 'react';
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
  const [step, setStep] = useState<'form' | 'processing' | 'success'>('form');
  const [error, setError] = useState<string | null>(null);
  const { accessToken } = useSupabaseAuth();

  if (!jobData) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <h2 className="text-2xl font-black text-slate-900 mb-4">Missing job details</h2>
        <p className="text-slate-500 font-medium mb-8">Please return and complete the job submission first.</p>
        <button onClick={onCancel} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black">
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
          setError("Missing auth. Please sign in again.");
          setStep("form");
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
        <h1 className="text-5xl font-black text-slate-900 mb-6 tracking-tight">Payment Successful!</h1>
        <p className="text-lg text-slate-500 mb-2 font-medium">The role &quot;{jobData?.title}&quot; has been successfully activated.</p>
        <p className="text-sm text-slate-400 font-bold mb-12">Confirmation sent to your email. Matches sent to subscribers.</p>
        <button onClick={onSuccess} className="bg-indigo-600 text-white px-10 py-5 rounded-3xl font-black text-xl shadow-xl hover:scale-105 transition-all">Go to Dashboard</button>
      </div>
    );
  }

  if (step === 'processing') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center flex flex-col items-center animate-in fade-in">
        <div className="w-20 h-20 border-4 border-indigo-50 border-t-indigo-600 rounded-full animate-spin mb-10"></div>
        <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Processing Payment...</h2>
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Matching with Talent Pool...</p>
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
            <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Checkout</h2>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-6 py-5">
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Secure payment</p>
              <p className="mt-3 text-sm font-bold text-slate-700">
                You will complete payment securely on Stripe.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handlePay}
                className="w-full bg-indigo-600 text-white font-black py-6 rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all text-xl active:scale-[0.98]"
              >
                Continue to Stripe ({formatPrice(price)})
              </button>
              {error && (
                <p className="text-center text-red-500 text-sm font-bold mt-4">{error}</p>
              )}
              <button
                type="button"
                onClick={onCancel}
                className="w-full text-slate-400 font-bold mt-6 hover:text-slate-600 transition-colors"
              >
                Cancel & Return
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-8 sticky top-28">
           <div className="bg-slate-900 p-10 rounded-[3.5rem] text-white shadow-2xl">
              <h3 className="text-xl font-black mb-8 border-b border-white/10 pb-6">Order Summary</h3>
              <div className="space-y-6">
                 <div className="flex justify-between items-center">
                    <div>
                       <p className="font-black text-white">{jobData?.title || "New Listing"}</p>
                       <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{planName} 30-Day Listing</p>
                    </div>
                    <span className="font-black">{formatPrice(price)}</span>
                 </div>
                 <div className="pt-6 border-t border-white/10 flex justify-between items-center">
                    <span className="text-lg font-black uppercase tracking-widest text-slate-400">Total</span>
                    <span className="text-3xl font-black text-indigo-400">{formatPrice(price)}</span>
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
