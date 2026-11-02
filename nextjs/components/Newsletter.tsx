"use client";

import React, { useState } from "react";
import { subscribeUser } from "../services/notificationService";
import { CATEGORY_HUBS } from "../lib/categories";

const Newsletter: React.FC = () => {
  const [email, setEmail] = useState("");
  const [preference, setPreference] = useState("All");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [msg, setMsg] = useState("");

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await subscribeUser(email, preference);
    if (result.success) {
      setStatus("success");
      setMsg(result.message);
      setEmail("");
      setTimeout(() => setStatus("idle"), 3000);
    } else {
      setStatus("error");
      setMsg(result.message);
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  return (
    <section id="subscribe" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 scroll-mt-20">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600">Get alerts</p>
          <h2 className="mt-1 text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">
            Salary-first roles in your inbox.
          </h2>
          <p className="mt-3 text-slate-600 text-sm">
            Pick a category and we’ll email you when a matching role is published.
          </p>
        </div>

        <form onSubmit={handleSubscribe} className="mt-6 max-w-2xl mx-auto space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              id="alert-category"
              value={preference}
              onChange={(e) => setPreference(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 h-10 text-sm text-slate-700 outline-none"
            >
              <option value="All">All categories</option>
              {CATEGORY_HUBS.map((hub) => (
                <option key={hub.slug} value={hub.slug}>
                  {hub.label}
                </option>
              ))}
            </select>
            <input
              id="alert-email"
              type="email"
              required
              placeholder="Email address"
              className="sm:col-span-1 flex-1 px-3 h-10 rounded-lg bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 text-sm outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              type="submit"
              className={`h-10 rounded-lg text-sm font-medium ${
                status === "success"
                  ? "bg-emerald-600 text-white"
                  : status === "error"
                    ? "bg-rose-600 text-white"
                    : "bg-indigo-600 text-white hover:bg-indigo-700"
              }`}
            >
              {status === "success" ? "Subscribed" : status === "error" ? "Try again" : "Get alerts"}
            </button>
          </div>
          {msg && (
            <p className={`text-xs text-center ${status === "error" ? "text-rose-600" : "text-emerald-700"}`}>{msg}</p>
          )}
          <p className="text-slate-500 text-xs text-center">Unsubscribe anytime. Same alerts as the Alerts page.</p>
        </form>
      </div>
    </section>
  );
};

export default Newsletter;
