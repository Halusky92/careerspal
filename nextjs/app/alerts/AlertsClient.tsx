"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useSupabaseAuth } from "../../components/Providers";
import { authFetch } from "../../lib/authFetch";
import { CATEGORY_HUBS, type CategoryHub, getCategoryHub, resolveCategoryParam } from "../../lib/categories";
import { subscribeUser } from "../../services/notificationService";

type AlertsClientProps = {
  initialCategory?: string | null;
};

const getHubOrDefault = (value?: string | null): CategoryHub => {
  const resolved = resolveCategoryParam(value);
  const hub = resolved !== "All Roles" ? getCategoryHub(resolved) : null;
  return hub || CATEGORY_HUBS[0];
};

export default function AlertsClient({ initialCategory }: AlertsClientProps) {
  const { profile, accessToken, loading } = useSupabaseAuth();
  const [email, setEmail] = useState("");
  const [hubSlug, setHubSlug] = useState<string>(() => getHubOrDefault(initialCategory).slug);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");

  const hub = useMemo(() => getHubOrDefault(hubSlug), [hubSlug]);
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
            body: JSON.stringify({ query: hub.slug }),
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
          body: JSON.stringify({ email: profile.email, preference: hub.slug }),
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
      const result = await subscribeUser(trimmed, hub.slug);
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
        <p className="mt-3 text-[15px] text-slate-700 max-w-2xl">
          One list, one category. We’ll email you when a matching role is published. Sign in to change or stop it later.
        </p>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500" htmlFor="alert-category">
            Category
          </label>
          <select
            id="alert-category"
            value={hubSlug}
            onChange={(e) => setHubSlug(e.target.value)}
            className="cp-field mt-1.5 w-full h-10 rounded-lg bg-white px-3 text-sm text-slate-700 outline-none"
          >
            {CATEGORY_HUBS.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

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

        <p className="text-xs text-slate-500">We’ll only email new published roles that match this category.</p>
      </div>
    </div>
  );
}
