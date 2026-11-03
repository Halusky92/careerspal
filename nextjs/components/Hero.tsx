"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseAuth } from "./Providers";
import PredictiveField from "./PredictiveField";

interface HeroProps {
  onBrowse: () => void;
  onGetAlerts: () => void;
}

const CATEGORY_CHIPS = [
  { label: "Operations", value: "operations" },
  { label: "Systems", value: "systems" },
  { label: "Automation", value: "automation" },
  { label: "RevOps", value: "revops" },
  { label: "Product Ops", value: "product-ops" },
  { label: "Chief of Staff", value: "chief-of-staff" },
];

const Hero: React.FC<HeroProps> = ({ onBrowse, onGetAlerts }) => {
  const router = useRouter();
  const { profile } = useSupabaseAuth();
  const [query, setQuery] = useState("");

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
    const qs = params.toString();
    router.push(qs ? `/jobs?${qs}` : "/jobs");
  };

  return (
    <section className="relative overflow-hidden bg-[#EEF2F8]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-indigo-300/30 blur-3xl" />
        <div className="absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-sky-200/45 blur-3xl" />
        <div className="absolute -bottom-16 -right-10 h-48 w-48 rounded-full bg-violet-200/35 blur-3xl" />
        <svg className="absolute inset-0 h-full w-full opacity-[0.35]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="cp-hero-dots" width="22" height="22" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="1" fill="#94a3b8" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#cp-hero-dots)" />
        </svg>
      </div>

      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-7 sm:pb-10 text-center">
        {firstName && (
          <p className="text-sm font-medium text-indigo-700">Hello, {firstName}</p>
        )}
        <h1 className="mt-1 text-[1.75rem] sm:text-4xl font-semibold tracking-tight text-slate-900 leading-[1.15]">
          Find your next Ops role
        </h1>
        <p className="mt-2.5 text-sm sm:text-base text-slate-600 max-w-xl mx-auto">
          Salary-first listings with clear scope. Apply on the company site.
        </p>

        <form onSubmit={submit} className="mt-5 sm:mt-6 text-left relative">
          <div
            className="cp-search flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0 rounded-2xl sm:rounded-full p-2 sm:p-1.5 sm:pl-4"
          >
            <PredictiveField
              value={query}
              onChange={setQuery}
              placeholder="Job title, company, or tool"
              ariaLabel="Search jobs"
              inputClassName="h-11 w-full rounded-xl sm:rounded-none border-0 bg-transparent px-3 sm:px-2 text-[16px] sm:text-sm text-slate-900 outline-none"
            />
            <button
              type="submit"
              onClick={() => submit()}
              className="h-11 px-5 shrink-0 rounded-xl sm:rounded-full bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
            >
              Search
            </button>
          </div>
        </form>

        <div className="mt-4 -mx-4 sm:mx-0">
          <div className="flex flex-nowrap items-center justify-start sm:justify-center gap-1.5 overflow-x-auto no-scrollbar px-4 sm:px-0">
            {CATEGORY_CHIPS.map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => router.push(`/jobs?category=${encodeURIComponent(chip.value)}`)}
                className="h-8 shrink-0 px-3 rounded-full bg-white border border-slate-300 text-xs font-medium text-slate-800 hover:border-slate-900"
              >
                {chip.label}
              </button>
            ))}
            <button
              type="button"
              onClick={onBrowse}
              className="h-8 shrink-0 px-3 rounded-full bg-white border border-slate-300 text-xs font-medium text-slate-800 hover:border-slate-900"
            >
              All jobs
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onGetAlerts}
          className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-indigo-600 px-5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Email me new roles
        </button>
      </div>
    </section>
  );
};

export default Hero;
