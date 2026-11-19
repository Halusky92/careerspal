import Link from "next/link";
import { getCategoryHubForDbCategory } from "../lib/categories";
import type { SalaryBucket } from "../lib/salaryBoardSummary";

function formatCompact(amount: number) {
  const rounded = Math.round(amount / 1000) * 1000;
  if (rounded >= 10_000) return `$${Math.round(rounded / 1000)}k`;
  return `$${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(rounded)}`;
}

const TINT: Record<string, { bar: string; tick: string; chip: string }> = {
  operations: { bar: "bg-sky-200", tick: "border-sky-700", chip: "bg-sky-50 text-sky-800" },
  systems: { bar: "bg-emerald-200", tick: "border-emerald-700", chip: "bg-emerald-50 text-emerald-800" },
  automation: { bar: "bg-amber-200", tick: "border-amber-700", chip: "bg-amber-50 text-amber-800" },
  revops: { bar: "bg-violet-200", tick: "border-violet-700", chip: "bg-violet-50 text-violet-800" },
  "product-ops": { bar: "bg-indigo-200", tick: "border-indigo-700", chip: "bg-indigo-50 text-indigo-800" },
  "chief-of-staff": { bar: "bg-teal-200", tick: "border-teal-700", chip: "bg-teal-50 text-teal-800" },
};

const FALLBACK = { bar: "bg-slate-200", tick: "border-slate-700", chip: "bg-slate-50 text-slate-700" };

function medianShare(bucket: SalaryBucket) {
  const span = bucket.max - bucket.min;
  if (span <= 0) return 50;
  return Math.min(100, Math.max(0, ((bucket.median - bucket.min) / span) * 100));
}

export default function SalaryInsights({ buckets }: { buckets: SalaryBucket[] }) {
  return (
    <div className="bg-[#F8F9FD]">
      <div className="mx-auto max-w-xl px-4 py-6">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Pay on the board</h1>
        <p className="mt-1.5 text-sm leading-6 text-slate-600">
          The bar is the lowest to highest listing midpoint. The mark is the median. USD roles only. Not a market-wide salary survey.
        </p>

        {buckets.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center">
            <p className="text-sm text-slate-700">Not enough parsed salaries in one category yet.</p>
            <Link href="/jobs" className="mt-3 inline-flex text-sm font-medium text-indigo-700 hover:underline">
              Browse jobs
            </Link>
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {buckets.map((bucket) => {
              const slug = getCategoryHubForDbCategory(bucket.category)?.slug || "";
              const tint = TINT[slug] || FALLBACK;
              const share = medianShare(bucket);
              return (
                <li key={bucket.category}>
                  <Link
                    href={`/jobs?category=${encodeURIComponent(bucket.category)}`}
                    className="block rounded-xl border border-slate-200 bg-white px-3 py-2.5 hover:border-indigo-200"
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-semibold text-slate-900">{bucket.label}</span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                        {formatCompact(bucket.min)}–{formatCompact(bucket.max)}
                      </span>
                    </span>
                    <span className="relative mt-2 block h-1.5 rounded-full bg-slate-100">
                      <span className={`absolute inset-0 rounded-full ${tint.bar}`} />
                      <span
                        className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white ${tint.tick}`}
                        style={{ left: `${share}%` }}
                      />
                    </span>
                    <span className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                      <span>
                        {bucket.count} {bucket.count === 1 ? "listing" : "listings"}
                        {bucket.count < 8 ? <span className={`ml-1.5 rounded-full px-1.5 py-0.5 ${tint.chip}`}>small sample</span> : null}
                      </span>
                      <span className="tabular-nums">median {formatCompact(bucket.median)}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
