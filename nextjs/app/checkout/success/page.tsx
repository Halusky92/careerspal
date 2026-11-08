"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSupabaseAuth } from "../../../components/Providers";
import { authFetch } from "../../../lib/authFetch";

type SessionPayload = {
  paid?: boolean;
  title?: string;
  listingStatus?: string;
  planType?: string;
  amount?: number;
  error?: string;
};

function CheckoutSuccessInner() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id") || "";
  const { accessToken, loading } = useSupabaseAuth();
  const [payload, setPayload] = useState<SessionPayload | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!sessionId || !accessToken) return;
      try {
        const response = await authFetch(
          `/api/stripe/session?session_id=${encodeURIComponent(sessionId)}`,
          {},
          accessToken,
        );
        const data = (await response.json()) as SessionPayload;
        setPayload(data);
      } catch {
        setPayload({ error: "Unable to confirm this payment yet." });
      }
    };
    load();
  }, [accessToken, sessionId]);

  const paid = payload?.paid === true;
  const title = payload?.title;
  const waiting = Boolean(sessionId && accessToken && !payload) || loading;

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-16 sm:py-20">
      <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Checkout</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900 tracking-tight">
          {waiting ? "Confirming payment…" : paid ? "Payment received" : "Checkout finished"}
        </h1>
        <p className="mt-3 text-sm text-slate-600 leading-relaxed">
          {paid
            ? `${title ? `“${title}”` : "Your listing"} is paid. It waits for a last check, then it can go live. That is not a timed SLA.`
            : "Stripe will confirm, then the listing waits for a last check. You also get an email. That is not a timed SLA."}
        </p>
        {payload?.planType ? (
          <p className="mt-2 text-sm text-slate-500">
            {payload.planType}
            {typeof payload.amount === "number" ? ` · $${payload.amount}` : ""}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col sm:flex-row gap-2">
          <Link
            href="/dashboard/employer"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Employer dashboard
          </Link>
          <Link
            href="/post-a-job"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Post another
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-lg mx-auto px-4 py-16 text-sm text-slate-500">Confirming payment…</div>
      }
    >
      <CheckoutSuccessInner />
    </Suspense>
  );
}
