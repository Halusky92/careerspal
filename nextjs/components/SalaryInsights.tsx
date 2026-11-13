import Link from "next/link";
import type { SalaryBucket } from "../lib/salaryBoardSummary";

function formatYearly(amount: number) {
  const rounded = Math.round(amount / 1000) * 1000;
  if (rounded >= 10_000) return `$${Math.round(rounded / 1000)}k a year`;
  return `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(rounded)} a year`;
}

export default function SalaryInsights({ buckets }: { buckets: SalaryBucket[] }) {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="text-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">Ranges from live listings</h1>
        <p className="mt-4 text-slate-700 font-medium max-w-2xl mx-auto">
          Parsed from roles currently on the board. A small category can be three listings. This is not a US labor-market benchmark.
        </p>
      </div>

      {buckets.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-lg font-black text-slate-900">No salary summary yet.</p>
          <p className="mt-2 text-slate-600 font-medium">There aren’t enough live listings in a category to show a range.</p>
          <Link
            href="/jobs"
            className="mt-6 inline-flex px-6 py-3 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest"
          >
            Browse jobs
          </Link>
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
                  {formatYearly(bucket.min).replace(" a year", "")}–{formatYearly(bucket.max)}
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-600 font-medium">
                Midpoint {formatYearly(bucket.median)}
              </p>
            </div>
          ))}
          <div className="pt-4 text-center">
            <Link href="/jobs" className="text-indigo-600 font-black text-sm hover:underline">
              Browse jobs →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
