"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

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

const Hero: React.FC<HeroProps> = ({ onBrowse }) => {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");

  const submit = (event?: React.FormEvent) => {
    event?.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("query", query.trim());
    if (location.trim()) params.set("location", location.trim());
    const qs = params.toString();
    router.push(qs ? `/jobs?${qs}` : "/jobs");
  };

  return (
    <section className="border-b border-slate-200/70 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
        <h1 className="text-lg sm:text-xl font-semibold text-slate-900 tracking-tight">
          Remote Ops & Systems jobs
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Salary-first listings in Operations, Systems, Automation, RevOps, Product Ops, and Chief of Staff.
        </p>

        <form onSubmit={submit} className="mt-3">
          <div className="flex flex-col sm:flex-row gap-2 min-w-0">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Job title, company, or tool"
              className="h-11 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              aria-label="Search jobs"
            />
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location or remote"
              className="h-11 min-w-0 sm:w-40 sm:flex-none rounded-lg border border-slate-300 px-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              aria-label="Location"
            />
            <button
              type="submit"
              className="h-11 px-4 shrink-0 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
            >
              Find jobs
            </button>
          </div>
        </form>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {CATEGORY_CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => router.push(`/jobs?category=${encodeURIComponent(chip.value)}`)}
              className="h-8 px-3 rounded-full border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 hover:border-indigo-200 hover:text-indigo-700"
            >
              {chip.label}
            </button>
          ))}
          <button type="button" onClick={onBrowse} className="h-8 px-3 text-xs font-medium text-indigo-600">
            All jobs
          </button>
        </div>
      </div>
    </section>
  );
};

export default Hero;
