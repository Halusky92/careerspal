"use client";

import React from "react";

interface HeroProps {
  onBrowse: () => void;
  onGetAlerts: () => void;
}

const Hero: React.FC<HeroProps> = ({ onBrowse, onGetAlerts }) => {
  return (
    <section className="relative pt-12 pb-14 sm:pt-18 sm:pb-18 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute inset-0 sm:hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.18),transparent_60%)]"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(139,92,246,0.14),transparent_55%)]"></div>
          <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(15,23,42,0.03)_0%,rgba(255,255,255,0)_55%,rgba(15,23,42,0.04)_100%)]"></div>
        </div>
        <div className="absolute inset-0 hidden sm:block bg-[radial-gradient(circle_at_top,rgba(79,70,229,0.12),transparent_60%)]"></div>
        <div className="absolute top-[-20%] left-[-15%] w-[80%] h-[80%] bg-indigo-300/20 rounded-full blur-[100px] sm:blur-[160px] opacity-60"></div>
        <div
          className="absolute bottom-[-15%] right-[-10%] w-[70%] h-[70%] bg-violet-400/20 rounded-full blur-[100px] sm:blur-[160px] opacity-60"
          style={{ animationDelay: "3.5s" }}
        ></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-white/70 backdrop-blur border border-slate-200/60 px-4 py-2 rounded-full shadow-sm">
            <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">
              Notion-heavy • Salary-first • Remote
            </span>
          </div>

          <h1 className="mt-6 text-4xl sm:text-6xl md:text-7xl font-black text-slate-900 tracking-tight leading-[1.05]">
            Notion-heavy remote roles in Ops, Systems & Automation.
          </h1>

          <p className="mt-5 text-base sm:text-lg text-slate-600 font-medium max-w-2xl">
            Built for modern business operations and systems builders. Also covers RevOps, Product Ops, and Chief of Staff — always salary-first and reviewed for clarity.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <button
              onClick={onBrowse}
              className="w-full sm:w-auto bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition-colors shadow-xl shadow-indigo-100"
            >
              Browse jobs
            </button>
            <button
              type="button"
              onClick={onGetAlerts}
              className="w-full sm:w-auto bg-white/80 backdrop-blur text-slate-900 border border-slate-200 px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:border-indigo-200 hover:text-indigo-700 transition-colors shadow-sm"
            >
              Get alerts
            </button>
            <a
              href="/post-a-job"
              className="w-full sm:w-auto text-center bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-black transition-colors"
            >
              Post a job
            </a>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
            <span className="inline-flex items-center gap-2">
              <span className="text-emerald-600 font-black">✓</span> Salary ranges required
            </span>
            <span className="hidden sm:inline text-slate-300">•</span>
            <span className="inline-flex items-center gap-2">
              <span className="text-emerald-600 font-black">✓</span> Reviewed for scope clarity
            </span>
            <span className="hidden sm:inline text-slate-300">•</span>
            <span className="inline-flex items-center gap-2">
              <span className="text-emerald-600 font-black">✓</span> Clear apply links
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
