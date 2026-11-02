"use client";

import type { ReactNode } from "react";
import Link from "next/link";

export default function FeaturedBoardZone({
  count,
  children,
}: {
  count: number;
  children: ReactNode;
}) {
  return (
    <section
      aria-label="Featured listings"
      className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-2 sm:p-2.5"
    >
      <div className="flex items-baseline justify-between gap-3 px-1 pb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-indigo-900">Featured</h2>
        <p className="text-[11px] text-indigo-800/80">
          Paid placement{count > 0 ? ` · ${count}` : ""}
        </p>
      </div>
      {count > 0 ? (
        <div className="space-y-2">{children}</div>
      ) : (
        <div className="rounded-xl border border-dashed border-indigo-200 bg-white/70 px-3 py-3">
          <p className="text-sm font-medium text-slate-900">No paid placement right now.</p>
          <p className="mt-1 text-xs text-slate-600">
            Featured Pro and Elite sit here for 30 days. Standard listings stay on the main board.
          </p>
          <Link href="/pricing" className="mt-2 inline-block text-xs font-medium text-indigo-700 hover:text-indigo-900">
            See placement plans
          </Link>
        </div>
      )}
    </section>
  );
}
