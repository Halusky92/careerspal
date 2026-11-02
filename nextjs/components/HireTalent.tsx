"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Job } from "../types";

interface HireTalentProps {
  onPostJob: () => void;
}

const GROUPS = [
  {
    heading: "On the board",
    items: [
      { title: "Post a job", text: "Salary, scope, and a working apply link. Reviewed before it is published." },
      { title: "Boost visibility", text: "Pro and Elite place the listing higher on the board. Same review standard." },
      { title: "Company page", text: "Live roles under your company, with no invented benefits or reviews." },
    ],
  },
  {
    heading: "How people apply",
    items: [
      { title: "Your apply link", text: "Candidates go to your ATS or careers page. We do not run a talent pool." },
      { title: "Email alerts", text: "Job seekers can subscribe to new published roles in a category." },
    ],
  },
  {
    heading: "Before it goes live",
    items: [
      { title: "Salary on the listing", text: "A range or clear compensation is required." },
      { title: "Reviewed before publish", text: "Title, scope, apply URL, niche. Not an SLA on timing." },
    ],
  },
];

const HireTalent: React.FC<HireTalentProps> = ({ onPostJob }) => {
  const [companyNames, setCompanyNames] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/jobs")
      .then((res) => res.json())
      .then((data: { jobs?: Job[] }) => {
        if (cancelled) return;
        const names = Array.from(
          new Set((data.jobs || []).map((job) => job.company).filter((name): name is string => Boolean(name))),
        ).slice(0, 8);
        setCompanyNames(names);
      })
      .catch(() => {
        if (!cancelled) setCompanyNames([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const logosLabel = useMemo(() => {
    if (companyNames.length < 2) return null;
    return companyNames.slice(0, 6);
  }, [companyNames]);

  return (
    <div>
      <section className="bg-indigo-700 text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-100">
            Post a job on CareersPal
          </p>
          <h1 className="mt-3 text-3xl sm:text-5xl font-semibold tracking-tight">
            Post a role. Salary on the listing.
          </h1>
          <p className="mt-4 text-[16px] sm:text-lg text-indigo-50 max-w-xl mx-auto leading-relaxed">
            Ops, Systems, Automation, RevOps, Product Ops, Chief of Staff. It goes live on the public board after review.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={onPostJob}
              className="w-full sm:w-auto h-12 px-8 rounded-lg bg-amber-400 text-slate-900 text-base font-semibold hover:bg-amber-300"
            >
              Post a job
            </button>
            <Link
              href="/pricing"
              className="w-full sm:w-auto h-12 px-8 rounded-lg border border-white/40 text-white text-base font-medium hover:bg-white/10 inline-flex items-center justify-center"
            >
              See pricing
            </Link>
          </div>
          <p className="mt-4 text-sm text-indigo-100">
            First 10 Standard listings: $1, then Standard $79 / Pro $149 / Elite $499.
          </p>
        </div>
      </section>

      {logosLabel && (
        <section className="bg-indigo-800">
          <div className="max-w-4xl mx-auto px-4 py-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
            {logosLabel.map((name) => (
              <span key={name} className="text-sm font-semibold text-white/90 tracking-tight">
                {name}
              </span>
            ))}
          </div>
          <p className="pb-4 text-center text-[11px] text-indigo-200">Companies with live roles on CareersPal. Not endorsements.</p>
        </section>
      )}

      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">
          What you can do here
        </h2>
        <p className="mt-2 text-[15px] text-slate-700 max-w-2xl">
          Post a listing, boost it, or show live roles on your company page. People apply on your link.
        </p>

        <div className="mt-8 space-y-8">
          {GROUPS.map((group) => (
            <div key={group.heading}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{group.heading}</p>
              <ul className="mt-3 divide-y divide-slate-200 border-t border-slate-200">
                {group.items.map((item) => (
                  <li key={item.title} className="py-4">
                    <p className="text-base font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-[15px] text-slate-700">{item.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={onPostJob}
            className="h-12 px-6 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
          >
            Post a job
          </button>
          <Link
            href="/jobs"
            className="h-12 px-6 rounded-lg border-2 border-slate-900 text-slate-900 text-sm font-semibold inline-flex items-center justify-center hover:bg-slate-50"
          >
            Visit CareersPal for job seekers
          </Link>
        </div>
      </section>
    </div>
  );
};

export default HireTalent;
