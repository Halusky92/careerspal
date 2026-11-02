"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Job } from "../types";
import { parseSalaryFromText } from "../lib/sourcing/normalization/salary";
import { CATEGORY_FILTER_LABELS } from "../constants";
import { isOnNicheJob } from "../lib/nicheScope";
import { formatSalaryDisplay } from "../lib/formatSalary";

interface SalaryInsightsProps {
  onBrowse: () => void;
}

type Bucket = {
  category: string;
  label: string;
  count: number;
  min: number;
  max: number;
  median: number;
};

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (!sorted.length) return 0;
  if (sorted.length % 2 === 0) return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  return sorted[mid];
}

function yearlyAmount(job: Job): number | null {
  const parsed = parseSalaryFromText(job.salary || "");
  if (!parsed.salary_present) return null;
  const mid =
    parsed.salary_amount_min != null && parsed.salary_amount_max != null
      ? (parsed.salary_amount_min + parsed.salary_amount_max) / 2
      : parsed.salary_amount_min ?? parsed.salary_amount_max;
  if (mid == null) return null;
  if (parsed.salary_period === "month") return mid * 12;
  if (parsed.salary_period === "hour") return mid * 2080;
  if (parsed.salary_period === "day") return mid * 260;
  return mid;
}

const SalaryInsights: React.FC<SalaryInsightsProps> = ({ onBrowse }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/jobs");
        const data = (await res.json()) as { jobs?: Job[] };
        setJobs(Array.isArray(data.jobs) ? data.jobs.filter((j) => isOnNicheJob(j)) : []);
      } catch {
        setJobs([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const buckets = useMemo(() => {
    const byCat = new Map<string, number[]>();
    jobs.forEach((job) => {
      const amount = yearlyAmount(job);
      if (amount == null) return;
      const key = job.category || "Operations";
      const list = byCat.get(key) || [];
      list.push(amount);
      byCat.set(key, list);
    });
    const out: Bucket[] = [];
    byCat.forEach((amounts, category) => {
      if (amounts.length < 3) return;
      out.push({
        category,
        label: CATEGORY_FILTER_LABELS[category] || category,
        count: amounts.length,
        min: Math.min(...amounts),
        max: Math.max(...amounts),
        median: median(amounts),
      });
    });
    return out.sort((a, b) => b.count - a.count);
  }, [jobs]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="text-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">Salary ranges on the board.</h1>
        <p className="mt-4 text-slate-600 font-medium max-w-2xl mx-auto">
          Taken from currently published listings. Not a market forecast.
        </p>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500 font-medium">Loading…</div>
      ) : buckets.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-lg font-black text-slate-900">No salary summary yet.</p>
          <p className="mt-2 text-slate-600 font-medium">There aren’t enough live listings in a category to show a range.</p>
          <button
            onClick={onBrowse}
            className="mt-6 px-6 py-3 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest"
          >
            Browse jobs
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {buckets.map((bucket) => (
            <div key={bucket.category} className="rounded-[1.8rem] border border-slate-200 bg-white p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-slate-900">{bucket.label}</h2>
                  <p className="text-sm text-slate-500 font-medium mt-1">{bucket.count} live listings with a parsed salary</p>
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {formatSalaryDisplay(`USD ${bucket.min}-${bucket.max} year`)}
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-600 font-medium">
                Midpoint around {formatSalaryDisplay(`USD ${bucket.median} year`)}
              </p>
            </div>
          ))}
          <div className="pt-4 text-center">
            <button onClick={onBrowse} className="text-indigo-600 font-black text-sm hover:underline">
              Browse jobs →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalaryInsights;
