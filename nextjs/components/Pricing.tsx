import React from "react";
import { PlanType } from "../types";

interface PricingProps {
  onSelectPlan: (type: PlanType, price: number) => void;
}

const Pricing: React.FC<PricingProps> = ({ onSelectPlan }) => {
  return (
    <div className="max-w-6xl mx-auto px-4 pb-8">
      <div className="text-center mb-5">
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Post a role on the board</h1>
        <p className="mt-1 text-sm text-slate-600">Reviewed before it goes live. Candidates apply on your link.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex flex-col">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800">Start pack</p>
          <h2 className="mt-1 text-base font-semibold text-slate-900">First 10 listings</h2>
          <p className="mt-2 text-3xl font-semibold text-emerald-800">
            Free <span className="text-sm font-medium text-emerald-700">/ 10 Standard</span>
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-slate-700 flex-1">
            <li>10 Standard roles, then paid plans</li>
            <li>Reviewed before publish</li>
            <li>30 days live each</li>
          </ul>
          <button
            type="button"
            onClick={() => onSelectPlan("Standard", 0)}
            className="mt-4 h-10 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
          >
            Use Start pack
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col">
          <h2 className="text-base font-semibold text-slate-900">Standard</h2>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            $79 <span className="text-sm font-medium text-slate-500">/ 30 days</span>
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-slate-700 flex-1">
            <li>On the board after review</li>
            <li>Search and filters</li>
            <li>Your apply link</li>
          </ul>
          <button
            type="button"
            onClick={() => onSelectPlan("Standard", 79)}
            className="mt-4 h-10 rounded-lg border border-slate-200 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Select Standard
          </button>
        </div>

        <div className="rounded-xl border border-indigo-200 bg-indigo-600 p-4 flex flex-col text-white">
          <h2 className="text-base font-semibold">Featured Pro</h2>
          <p className="mt-2 text-3xl font-semibold">
            $149 <span className="text-sm font-medium text-indigo-100">/ 30 days</span>
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-indigo-50 flex-1">
            <li>Higher on the board for 1 week</li>
            <li>Same review standard</li>
            <li>Help on listing copy</li>
          </ul>
          <button
            type="button"
            onClick={() => onSelectPlan("Featured Pro", 149)}
            className="mt-4 h-10 rounded-lg bg-white text-indigo-700 text-sm font-semibold hover:bg-indigo-50"
          >
            Select Pro
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-900 p-4 flex flex-col text-white">
          <h2 className="text-base font-semibold">Elite Managed</h2>
          <p className="mt-2 text-3xl font-semibold">
            $249 <span className="text-sm font-medium text-slate-300">/ 30 days</span>
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-slate-200 flex-1">
            <li>Top of board</li>
            <li>Hands-on listing help</li>
            <li>Same review standard</li>
          </ul>
          <button
            type="button"
            onClick={() => onSelectPlan("Elite Managed", 249)}
            className="mt-4 h-10 rounded-lg border border-white/30 text-sm font-semibold hover:bg-white/10"
          >
            Select Elite
          </button>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
