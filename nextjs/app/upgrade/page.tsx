"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseAuth } from "../../components/Providers";
import { authFetch } from "../../lib/authFetch";
import { trackFunnel } from "../../lib/funnelTrack";

export default function UpgradePage() {
  const router = useRouter();
  const { accessToken, loading } = useSupabaseAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stripe/checkout")
      .then((response) => response.json())
      .then((data: { available?: boolean }) => {
        if (!cancelled) setOpen(data.available === true);
      })
      .catch(() => {
        if (!cancelled) setOpen(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const startCheckout = async () => {
    if (!accessToken) {
      router.push(`/auth?from=${encodeURIComponent("/upgrade")}`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await authFetch(
        "/api/stripe/checkout",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ purpose: "board_access" }),
        },
        accessToken,
      );
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        setError(data.error || "Checkout is not available.");
        setBusy(false);
        return;
      }
      trackFunnel("checkout_started", { purpose: "board_access" });
      window.location.href = data.url;
    } catch {
      setError("Checkout is not available.");
      setBusy(false);
    }
  };

  const openPortal = async () => {
    if (!accessToken) {
      router.push(`/auth?from=${encodeURIComponent("/upgrade")}`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await authFetch("/api/stripe/portal", { method: "POST" }, accessToken);
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        setError(data.error || "Open billing in your account settings after the first payment.");
        setBusy(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Billing portal is not available.");
      setBusy(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-16">
      <h1 className="text-2xl font-semibold text-slate-900">Premium</h1>
      <p className="mt-2 text-sm text-slate-600">
        $7.99 per month. Unlimited search results, advanced filters, multiple saved searches, and daily alerts. Cancel in Stripe.
      </p>
      {open === false ? <p className="mt-6 text-sm text-slate-600">Premium checkout is not open.</p> : null}
      {open ? (
      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || loading}
          onClick={() => void startCheckout()}
          className="h-11 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-50"
        >
          {busy ? "Redirecting…" : "Continue to Stripe"}
        </button>
        <button
          type="button"
          disabled={busy || loading}
          onClick={() => void openPortal()}
          className="h-11 px-4 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-800 disabled:opacity-50"
        >
          Manage subscription
        </button>
      </div>
      ) : null}
      {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
