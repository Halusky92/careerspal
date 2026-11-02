"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseAuth } from "./Providers";

interface HeroProps {
  onBrowse: () => void;
  onGetAlerts: () => void;
}

const CATEGORY_CHIPS = [
  { label: "Operations", value: "Operations" },
  { label: "Systems", value: "Systems Design" },
  { label: "Automation", value: "Automation" },
  { label: "RevOps", value: "Marketing & Growth Ops" },
  { label: "Product Ops", value: "Product Management" },
  { label: "Chief of Staff", value: "Executive & Staff" },
];

const Hero: React.FC<HeroProps> = ({ onBrowse, onGetAlerts }) => {
  const router = useRouter();
  const { profile } = useSupabaseAuth();
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");

  const firstName = useMemo(() => {
    const name = (profile?.name || "").trim();
    if (!name) return null;
    const token = name.split(/\s+/)[0];
    if (!token || token.includes("@")) return null;
    return token;
  }, [profile?.name]);

  const submit = (event?: React.FormEvent) => {
    event?.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("query", query.trim());
    if (location.trim()) params.set("location", location.trim());
    const qs = params.toString();
    router.push(qs ? `/jobs?${qs}` : "/jobs");
  };

  return (
    <section className="bg-[#EEF2F8]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 sm:pt-14 pb-6 sm:pb-10 text-center">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">
          {firstName ? `Hello, ${firstName}` : "Find the next Ops role"}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Salary on every listing. Search, or pick a category.
        </p>

        <form onSubmit={submit} className="mt-5 sm:mt-7 text-left">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0 rounded-2xl sm:rounded-full bg-white border border-slate-200 shadow-[0_10px_28px_rgba(15,23,42,0.08)] p-2 sm:p-1.5 sm:pl-4">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Job title, company, or tool"
              className="h-11 min-w-0 flex-1 rounded-xl sm:rounded-none border-0 bg-transparent px-3 sm:px-2 text-sm text-slate-900 outline-none"
              aria-label="Search jobs"
            />
            <div className="hidden sm:block h-6 w-px bg-slate-200 flex-shrink-0" aria-hidden />
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Remote or city"
              className="h-11 min-w-0 sm:w-40 sm:flex-none rounded-xl sm:rounded-none border-0 bg-transparent px-3 sm:px-3 text-sm text-slate-900 outline-none"
              aria-label="Location"
            />
            <button
              type="submit"
              className="h-11 px-5 shrink-0 rounded-xl sm:rounded-full bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
            >
              Search
            </button>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
          {CATEGORY_CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => router.push(`/jobs?category=${encodeURIComponent(chip.value)}`)}
              className="h-8 px-3 rounded-full bg-white/80 border border-slate-200/80 text-xs font-medium text-slate-600 hover:border-indigo-200 hover:text-indigo-700"
            >
              {chip.label}
            </button>
          ))}
          <button type="button" onClick={onBrowse} className="h-8 px-3 text-xs font-medium text-indigo-600">
            All jobs
          </button>
        </div>

        <button
          type="button"
          onClick={onGetAlerts}
          className="mt-3 text-xs font-medium text-slate-500 hover:text-indigo-700"
        >
          Email me new roles
        </button>
      </div>
    </section>
  );
};

export default Hero;
