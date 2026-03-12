"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useSupabaseAuth } from "../../components/Providers";
import { CATEGORY_HUBS, type CategoryHub, getCategoryHub } from "../../lib/categories";

type AlertsClientProps = {
  initialCategory?: string | null;
};

const getHubOrDefault = (value?: string | null): CategoryHub => {
  const hub = value ? getCategoryHub(value) : null;
  return hub || CATEGORY_HUBS[0];
};

export default function AlertsClient({ initialCategory }: AlertsClientProps) {
  const { profile, loading, signInWithEmail, signInWithGoogle } = useSupabaseAuth();
  const [email, setEmail] = useState("");
  const [authStatus, setAuthStatus] = useState<"idle" | "sent" | "error">("idle");
  const [authMsg, setAuthMsg] = useState("");
  const [hubSlug, setHubSlug] = useState<string>(() => getHubOrDefault(initialCategory).slug);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const hub = useMemo(() => getHubOrDefault(hubSlug), [hubSlug]);
  const hasSession = Boolean(profile?.email);

  const alertQuery = useMemo(() => {
    // We store alerts as a query string (existing system). Keep it conservative + grounded.
    // TEMP: some hubs map to broader DB categories (see lib/categories.ts).
    return hub.dbCategories[0] || hub.label;
  }, [hub.dbCategories, hub.label]);

  const fromPath = useMemo(() => `/alerts?category=${encodeURIComponent(hub.slug)}`, [hub.slug]);

  const handleEmail = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setSaving(false);
    setSaveMsg("");
    setAuthStatus("idle");
    setAuthMsg("");
    try {
      const result = await signInWithEmail(trimmed, { role: "candidate", from: fromPath });
      if (result.error) {
        setAuthStatus("error");
        setAuthMsg(result.error);
      } else {
        setAuthStatus("sent");
        setAuthMsg("Magic link sent. Check your inbox.");
      }
    } catch {
      setAuthStatus("error");
      setAuthMsg("Unable to send a sign-in link right now.");
    }
  };

  const handleGoogle = async () => {
    setSaving(false);
    setSaveMsg("");
    setAuthStatus("idle");
    setAuthMsg("");
    await signInWithGoogle({ role: "candidate", from: fromPath });
  };

  const handleEnable = async () => {
    if (!hasSession) return;
    setSaving(true);
    setSaveMsg("");
    try {
      const response = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: alertQuery }),
      });
      const payload = (await response.json()) as { error?: string; existing?: boolean };
      if (!response.ok) {
        setSaveMsg(payload.error || "Unable to enable alerts right now.");
        return;
      }
      setSaveMsg(payload.existing ? "Alert already enabled." : "Alert enabled.");
    } catch {
      setSaveMsg("Unable to enable alerts right now.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-[2.75rem] border border-slate-200/60 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.06)] overflow-hidden">
      <div className="p-6 sm:p-10 border-b border-slate-100">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Alerts</p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
          Get new roles by email.
        </h1>
        <p className="mt-3 text-slate-600 font-medium max-w-2xl">
          Pick a category. We’ll email you when new published roles match your saved alert.
        </p>
      </div>

      <div className="p-6 sm:p-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="sm:col-span-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500" htmlFor="alert-category">
              Category
            </label>
            <select
              id="alert-category"
              value={hubSlug}
              onChange={(e) => setHubSlug(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/30"
            >
              {CATEGORY_HUBS.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Status</div>
            <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-4">
              <div className="text-sm font-bold text-slate-900">
                {hasSession ? `Signed in as ${profile?.email}` : "Not signed in"}
              </div>
              <div className="mt-1 text-xs text-slate-600 font-medium">
                Alerts are tied to your account email. You can manage them in your candidate dashboard.
              </div>
            </div>
          </div>
        </div>

        {hub.temporaryMappingNote && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 font-medium">
            Note: this category currently uses a broader internal mapping.
          </div>
        )}

        <div className="mt-6">
          {loading ? (
            <div className="text-sm font-bold text-slate-600">Loading…</div>
          ) : hasSession ? (
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={handleEnable}
                disabled={saving}
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-2xl bg-indigo-600 text-white px-7 py-4 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Enable alerts"}
              </button>
              <Link
                href="/dashboard/candidate"
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-2xl bg-white border border-slate-200 px-7 py-4 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:border-indigo-200 hover:text-indigo-700"
              >
                Manage alerts →
              </Link>
              {saveMsg && <div className="text-sm font-bold text-slate-700">{saveMsg}</div>}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="sr-only" htmlFor="alert-email">
                  Email
                </label>
                <input
                  id="alert-email"
                  type="email"
                  inputMode="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 font-bold outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
              <button
                type="button"
                onClick={handleEmail}
                disabled={!email.trim()}
                className="inline-flex items-center justify-center rounded-2xl bg-slate-900 text-white px-7 py-4 text-[10px] font-black uppercase tracking-widest hover:bg-black disabled:opacity-60"
              >
                Email me a sign-in link
              </button>

              <div className="sm:col-span-3 flex flex-col sm:flex-row gap-3 items-center justify-between">
                <button
                  type="button"
                  onClick={handleGoogle}
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-2xl bg-white border border-slate-200 px-7 py-4 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:border-indigo-200 hover:text-indigo-700"
                >
                  Continue with Google
                </button>
                <div className={`text-xs font-bold ${authStatus === "error" ? "text-rose-600" : authStatus === "sent" ? "text-emerald-700" : "text-slate-600"}`}>
                  {authMsg || "We’ll send a magic link to your email."}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 text-xs text-slate-500 font-medium">
          We’ll only email you about new published roles matching your alert. No hype.
        </div>
      </div>
    </div>
  );
}

