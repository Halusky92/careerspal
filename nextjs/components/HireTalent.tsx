"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Job } from "../types";
import { PLAN_PRICE_LINE } from "../lib/plans";
import PublicSubscriberNoteClient from "./PublicSubscriberNoteClient";

interface HireTalentProps {
  onPostJob: () => void;
}

const STEPS = [
  { title: "Post", text: "Salary, scope, and a working apply link." },
  { title: "Review", text: "Checked before it is published. Not a timed SLA." },
  { title: "Live", text: "On the public board. People apply on your link." },
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
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-12 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-100">For employers</p>
          <h1 className="mt-3 text-3xl sm:text-4xl font-semibold tracking-tight">
            A listing on the board. Your apply link.
          </h1>
          <p className="mt-3 text-[15px] sm:text-base text-indigo-50 max-w-lg mx-auto leading-relaxed">
            Ops, Systems, Automation, RevOps, Product Ops, Chief of Staff. Candidates apply on your ATS or careers page.
          </p>

          <ol className="mt-7 flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-sm font-semibold">
            {STEPS.map((step, index) => (
              <li key={step.title} className="inline-flex items-center gap-2 sm:gap-3">
                <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1.5">
                  <span className="text-indigo-200 mr-1.5">{index + 1}.</span>
                  {step.title}
                </span>
                {index < STEPS.length - 1 ? (
                  <span className="text-indigo-200" aria-hidden>
                    →
                  </span>
                ) : null}
              </li>
            ))}
          </ol>

          <div className="mt-8 flex flex-col items-center">
            <button
              type="button"
              onClick={onPostJob}
              className="h-12 px-10 rounded-lg bg-amber-400 text-slate-900 text-base font-semibold hover:bg-amber-300"
            >
              Post a job
            </button>
            <Link
              href="/pricing"
              className="mt-3 text-sm font-medium text-indigo-100 hover:text-white"
            >
              See pricing
            </Link>
          </div>
          <p className="mt-4 text-sm text-indigo-100">{PLAN_PRICE_LINE}</p>
        </div>
      </section>

      {logosLabel && (
        <section className="bg-indigo-800">
          <div className="max-w-4xl mx-auto px-4 py-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
            {logosLabel.map((name) => (
              <span key={name} className="text-sm font-semibold text-white/90 tracking-tight">
                {name}
              </span>
            ))}
          </div>
          <p className="pb-3 text-center text-[11px] text-indigo-200">Companies with live roles. Not endorsements.</p>
        </section>
      )}

      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <ol className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-xl border border-slate-200 bg-white px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {index + 1}. {step.title}
              </p>
              <p className="mt-2 text-sm text-slate-700">{step.text}</p>
            </li>
          ))}
        </ol>

        <ul className="mt-6 space-y-2 text-sm text-slate-700">
          <li>The listing is public after review. People apply on your link.</li>
          <li>
            Published roles can appear in twice-weekly email alerts. Not a guaranteed send or a promised volume.
            <PublicSubscriberNoteClient className="mt-1 text-sm text-slate-500" />
          </li>
          <li>
            Seekers who opt in can be opened in People. After we review a role, CareersPal may attach a few suggested seekers to that listing — not a volume or fit guarantee.
          </li>
          <li>Pro and Elite sit in a labeled featured zone on the same board.</li>
        </ul>

        <div className="mt-8 flex flex-col items-center">
          <button
            type="button"
            onClick={onPostJob}
            className="h-11 px-6 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
          >
            Post a job
          </button>
          <Link
            href="/jobs"
            className="mt-3 text-sm font-medium text-slate-600 hover:text-indigo-700"
          >
            See the board
          </Link>
        </div>
      </section>
    </div>
  );
};

export default HireTalent;
