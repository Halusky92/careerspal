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
        <p className="mt-2 text-[15px] sm:text-sm text-slate-700">
          Search by title, company, or category.
        </p>

        <form onSubmit={submit} className="mt-5 sm:mt-7 text-left relative">
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
            <div className="hidden sm:block h-6 w-px bg-slate-800/40 flex-shrink-0" aria-hidden />
            <div className="sm:w-40 sm:flex-none">
              <PredictiveField
                kind="location"
                value={location}
                onChange={setLocation}
                placeholder="Remote or city"
                ariaLabel="Location"
                inputClassName="h-11 w-full rounded-xl sm:rounded-none border-0 bg-transparent px-3 text-[16px] sm:text-sm text-slate-900 outline-none"
              />
            </div>
            <button
              type="submit"
              onClick={() => submit()}
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
              className="h-8 px-3 rounded-full bg-white border border-slate-300 text-xs font-medium text-slate-800 hover:border-slate-900"
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
          className="mt-3 text-sm font-medium text-slate-700 hover:text-indigo-700"
        >
          Email me new roles
        </button>
      </div>
    </section>
  );
};

export default Hero;
