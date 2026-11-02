"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useSupabaseAuth } from "../../components/Providers";
import { authFetch } from "../../lib/authFetch";
import { CATEGORY_HUBS, type CategoryHub, getCategoryHub } from "../../lib/categories";
import { subscribeUser } from "../../services/notificationService";

type AlertsClientProps = {
  initialCategory?: string | null;
};

const getHubOrDefault = (value?: string | null): CategoryHub => {
  const hub = value ? getCategoryHub(value) : null;
  return hub || CATEGORY_HUBS[0];
};

export default function AlertsClient({ initialCategory }: AlertsClientProps) {
  const { profile, accessToken, loading, signInWithEmail, signInWithGoogle } = useSupabaseAuth();
  const [email, setEmail] = useState("");
  const [authStatus, setAuthStatus] = useState<"idle" | "sent" | "error">("idle");
  const [authMsg, setAuthMsg] = useState("");
  const [hubSlug, setHubSlug] = useState<string>(() => getHubOrDefault(initialCategory).slug);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [guestStatus, setGuestStatus] = useState<"idle" | "ok" | "error">("idle");

  const hub = useMemo(() => getHubOrDefault(hubSlug), [hubSlug]);
  const hasSession = Boolean(profile?.email);

  const alertQuery = useMemo(() => {
    // We store alerts as a query string (existing system). Keep it conservative + grounded.
    // TEMP: some hubs map to broader DB categories (see lib/categories.ts).
    return hub.dbCategories[0] || hub.label;
  }, [hub.dbCategories, hub.label]);

  const fromPath = useMemo(() => `/alerts?category=${encodeURIComponent(hub.slug)}`, [hub.slug]);

  const handleGuestSubscribe = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setGuestStatus("idle");
    setSaving(true);
    const preference = (hub.dbCategories[0] || "All") as Parameters<typeof subscribeUser>[1];
    const result = await subscribeUser(trimmed, preference);
    setSaving(false);
    setGuestStatus(result.success ? "ok" : "error");
    setSaveMsg(result.message);
  };

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
      const response = await authFetch(
        "/api/alerts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: alertQuery }),
        },
        accessToken,
      );
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
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-100">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">Email alerts</p>
        <h1 className="mt-1 text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">
          One list. New published roles in your inbox.
        </h1>
        <p className="mt-3 text-[15px] text-slate-700 max-w-2xl">
          Alerts and the newsletter are the same thing: we email when a new Ops/Systems role goes live in your category. No extra blast.
        </p>
      </div>

      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div className="sm:col-span-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500" htmlFor="alert-category">
              Category
            </label>
            <select
              id="alert-category"
              value={hubSlug}
              onChange={(e) => setHubSlug(e.target.value)}
              className="cp-field mt-2 w-full rounded-2xl bg-white px-4 py-4 text-sm font-bold text-slate-700 outline-none"
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
              <div className="mt-1 text-xs text-slate-700 font-medium">
                Signed-in alerts live on your account. Guests can still join the same email list below.
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
                href="/account"
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
                  className="cp-field w-full px-5 py-4 rounded-2xl bg-white text-slate-900 placeholder:text-slate-400 font-bold outline-none"
                />
              </div>
              <button
                type="button"
                onClick={handleGuestSubscribe}
                disabled={!email.trim() || saving}
                className="inline-flex items-center justify-center rounded-2xl bg-slate-900 text-white px-7 py-4 text-sm font-semibold hover:bg-black disabled:opacity-60"
              >
                {saving ? "Saving…" : "Subscribe"}
              </button>

              <div className="sm:col-span-3 flex flex-col sm:flex-row gap-3 items-center justify-between">
                <button
                  type="button"
                  onClick={handleGoogle}
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-2xl bg-white border-2 border-slate-900 px-7 py-4 text-sm font-semibold text-slate-800"
                >
                  Continue with Google
                </button>
                <button
                  type="button"
                  onClick={handleEmail}
                  disabled={!email.trim()}
                  className="w-full sm:w-auto text-sm font-medium text-slate-700 underline-offset-2 hover:underline"
                >
                  Or send a sign-in link
                </button>
              </div>
              <div className={`sm:col-span-3 text-sm font-medium ${guestStatus === "error" || authStatus === "error" ? "text-rose-700" : guestStatus === "ok" || authStatus === "sent" ? "text-emerald-800" : "text-slate-700"}`}>
                {saveMsg || authMsg || "Subscribe with email only. Sign-in is optional, to manage alerts later."}
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

