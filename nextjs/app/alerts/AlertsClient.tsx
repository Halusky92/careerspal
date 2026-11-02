"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useSupabaseAuth } from "../../components/Providers";
import { authFetch } from "../../lib/authFetch";
import { parseAlertQuery, serializeAlertQuery } from "../../lib/categories";
import { subscribeUser } from "../../services/notificationService";
import AlertCategoryPicker from "../../components/AlertCategoryPicker";

type AlertsClientProps = {
  initialCategory?: string | null;
};

export default function AlertsClient({ initialCategory }: AlertsClientProps) {
  const { profile, accessToken, loading } = useSupabaseAuth();
  const [email, setEmail] = useState("");
  const [selected, setSelected] = useState<string[]>(() => parseAlertQuery(initialCategory));
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
      if (hasSession && profile?.email) {
        const response = await authFetch(
          "/api/alerts",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query }),
          },
          accessToken,
        );
        const payload = (await response.json()) as { error?: string; existing?: boolean };
        if (!response.ok) {
          setStatus("error");
          setSaveMsg(payload.error || "Unable to enable alerts right now.");
          return;
        }
        await fetch("/api/subscribers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: profile.email, preference: query }),
        });
        setStatus("ok");
        setSaveMsg(payload.existing ? "Alert already on. Manage it in your account." : "Alert on. Manage it in your account.");
        return;
      }

      const trimmed = email.trim();
      if (!trimmed) {
        setStatus("error");
        setSaveMsg("Enter an email address.");
        return;
      }
      const result = await subscribeUser(trimmed, query);
      setStatus(result.success ? "ok" : "error");
      setSaveMsg(
        result.success
          ? "You’re on the list. Sign in later if you want to change or stop this in your account."
          : result.message,
      );
    } catch {
      setStatus("error");
      setSaveMsg("Unable to enable alerts right now.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-100">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">Job alerts</p>
        <h1 className="mt-1 text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">Get new jobs by email</h1>
        <p className="mt-2 text-sm text-slate-600 max-w-2xl">
          Pick one category, several, or all. We’ll email new matching roles. Sign in to change or stop it later.
        </p>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        <AlertCategoryPicker selected={selected} onChange={setSelected} />

        {loading ? (
          <div className="text-sm text-slate-600">Loading…</div>
        ) : hasSession ? (
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={handleSubscribe}
              disabled={saving}
              className="w-full sm:w-auto inline-flex h-9 items-center justify-center rounded-lg bg-indigo-600 text-white px-4 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Enable alerts"}
            </button>
            <Link
              href="/account?tab=alerts"
              className="w-full sm:w-auto inline-flex h-9 items-center justify-center rounded-lg bg-white border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:border-indigo-200 hover:text-indigo-700"
            >
              Manage in account
            </Link>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              id="alert-email"
              type="email"
              inputMode="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="cp-field flex-1 h-10 px-3 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 text-sm outline-none"
            />
            <button
              type="button"
              onClick={handleSubscribe}
              disabled={!email.trim() || saving}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 text-white px-4 text-sm font-medium hover:bg-black disabled:opacity-60"
            >
              {saving ? "Saving…" : "Subscribe"}
            </button>
          </div>
        )}

        {saveMsg && (
          <div className={`text-sm ${status === "error" ? "text-rose-700" : "text-emerald-800"}`}>{saveMsg}</div>
        )}

        <p className="text-xs text-slate-500">We’ll only email new published roles that match your selection.</p>
      </div>
    </div>
  );
}
