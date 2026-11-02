"use client";

import React from "react";

interface HireTalentProps {
  onPostJob: () => void;
}

const HireTalent: React.FC<HireTalentProps> = ({ onPostJob }) => {
  return (
    <div className="relative overflow-hidden">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="text-center mb-6">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-500">For employers</p>
          <h1 className="mt-2 text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight">
            Post a role on CareersPal.
          </h1>
          <p className="mt-2 text-sm text-slate-600 max-w-2xl mx-auto">
            A salary-first board for Operations, Systems, Automation, RevOps, Product Ops, and Chief of Staff.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-5">
          {[
            { label: "What you get", value: "Board listing" },
            { label: "Before live", value: "Review" },
            { label: "Salary", value: "Required" },
          ].map((item) => (
            <div key={item.label} className="bg-white border border-slate-200/60 rounded-2xl px-4 py-4 text-center">
              <div className="text-xl font-black text-slate-900">{item.value}</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{item.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <ul className="space-y-3 text-slate-600 font-medium">
            <li>Your listing appears on the public board after review.</li>
            <li>Candidates apply through your own apply link.</li>
            <li>We do not run a talent pool, intros, or hiring SLA.</li>
          </ul>
          <div className="mt-5 flex flex-col sm:flex-row gap-2">
            <button
              onClick={onPostJob}
              className="px-8 py-4 rounded-2xl bg-indigo-600 text-white font-black uppercase tracking-widest text-[11px] hover:bg-indigo-700"
            >
              Post a job
            </button>
            <a
              href="/pricing"
              className="px-8 py-4 rounded-2xl bg-white border border-slate-200 text-slate-800 font-black uppercase tracking-widest text-[11px] text-center hover:border-indigo-200"
            >
              View pricing
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HireTalent;
