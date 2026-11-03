"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useSupabaseAuth } from "../../components/Providers";
import { authFetch } from "../../lib/authFetch";
import { parseAlertQuery, serializeAlertQuery } from "../../lib/categories";
import { ALERT_MIN_SALARIES, ALERT_REGIONS, type AlertRegion } from "../../lib/alertPrefs";
import AlertCategoryPicker from "../../components/AlertCategoryPicker";

type AlertsClientProps = {
  initialCategory?: string | null;
};

export default function AlertsClient({ initialCategory }: AlertsClientProps) {
  const { profile, accessToken, loading } = useSupabaseAuth();
  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState<string[]>(() => parseAlertQuery(initialCategory));
  const [minSalary, setMinSalary] = useState(0);
  const [region, setRegion] = useState<AlertRegion>("anywhere");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");

  const query = useMemo(() => serializeAlertQuery(selected), [selected]);
  const hasSession = Boolean(profile?.email);

  const handleSubscribe = async () => {
    setSaving(true);
    setSaveMsg("");
    setStatus("idle");
    try {
      const targetEmail = hasSession ? profile?.email || "" : email.trim();
      if (!targetEmail) {
        setStatus("error");
        setSaveMsg("Enter an email address.");
        return;
      }

      if (hasSession && accessToken) {
        await authFetch(
          "/api/alerts",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query }),
          },
          accessToken,
        );
      }

      const response = await fetch("/api/alerts/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: targetEmail,
          categories: selected,
          minSalary,
          region,
        }),
      });
      const payload = (await response.json()) as { error?: string; existing?: boolean; pendingConfirm?: boolean };
      if (!response.ok) {
        setStatus("error");
        setSaveMsg(payload.error || "Unable to subscribe right now.");
        return;
      }
      setStatus("ok");
      setSaveMsg(
        payload.pendingConfirm
          ? "Check your inbox — then you’ll stay in the loop on new roles."
          : payload.existing
            ? "Preferences saved. Fresh roles will keep landing in your inbox."
            : "You’re in. Fresh roles will land in your inbox.",
      );
    } catch {
      setStatus("error");
      setSaveMsg("Unable to subscribe right now.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-100">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">Job alerts</p>
        <h1 className="mt-1 text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">Stay in the loop</h1>
        <p className="mt-2 text-sm text-slate-600 max-w-2xl">
          Send your email and get fresh openings as they hit the market. Stay in the picture — no noise, just new roles.
        </p>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        <AlertCategoryPicker selected={selected} onChange={setSelected} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Minimum salary</span>
            <select
              value={minSalary}
              onChange={(event) => setMinSalary(Number(event.target.value))}
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800"
            >
              {ALERT_MIN_SALARIES.map((amount) => (
                <option key={amount} value={amount}>
                  {amount === 0 ? "Any listed salary" : `$${Math.round(amount / 1000)}k+ a year`}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Region</span>
            <select
              value={region}
              onChange={(event) => setRegion(event.target.value as AlertRegion)}
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800"
            >
              {ALERT_REGIONS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <div className="text-sm text-slate-600">Loading…</div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3">
            {!hasSession && (
              <input
                id="alert-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 h-10 px-3 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 text-sm outline-none"
              />
            )}
            <button
              type="button"
              onClick={handleSubscribe}
              disabled={saving || (!hasSession && !email.trim())}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 text-white px-4 text-sm font-medium hover:bg-black disabled:opacity-60"
            >
              {saving ? "Saving…" : hasSession ? "Save alert" : "Subscribe"}
            </button>
            {hasSession && (
              <Link
                href="/account?tab=alerts"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700"
              >
                Account
              </Link>
            )}
          </div>
        )}

        {saveMsg && (
          <div className={`text-sm ${status === "error" ? "text-rose-700" : "text-emerald-800"}`}>{saveMsg}</div>
        )}

        <p className="text-xs text-slate-500">Unsubscribe anytime from the email.</p>
      </div>
    </div>
  );
}
