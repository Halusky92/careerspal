import Link from "next/link";
import type { SalaryBucket } from "../lib/salaryBoardSummary";

function formatCompact(amount: number) {
  const rounded = Math.round(amount / 1000) * 1000;
  if (rounded >= 10_000) return `$${Math.round(rounded / 1000)}k`;
  return `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(rounded)}`;
}

export default function SalaryInsights({ buckets }: { buckets: SalaryBucket[] }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">Pay on the board</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Observed range is the lowest to highest listing midpoint. Median listing midpoint is the middle of those. USD roles only. Not a market-wide salary survey.
      </p>

      {buckets.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center">
          <p className="text-sm text-slate-700">Not enough parsed salaries in one category yet.</p>
          <Link href="/jobs" className="mt-3 inline-flex text-sm font-medium text-indigo-700 hover:underline">
            Browse jobs
          </Link>
        </div>
      ) : (
        <ul className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {buckets.map((bucket) => (
            <li key={bucket.category} className="border-b border-slate-100 last:border-b-0">
              <Link
                href={`/jobs?category=${encodeURIComponent(bucket.category)}`}
                className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-slate-50"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-900">{bucket.label}</span>
                  <span className="block text-xs text-slate-500">
                    {bucket.count} listings{bucket.count < 8 ? " · small sample" : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-medium text-slate-900">
                    {formatCompact(bucket.min)}–{formatCompact(bucket.max)}
                  </span>
                  <span className="block text-xs text-slate-500">median {formatCompact(bucket.median)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
