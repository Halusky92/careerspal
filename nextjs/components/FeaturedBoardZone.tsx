"use client";

import type { ReactNode } from "react";

export default function FeaturedBoardZone({
  count,
  children,
}: {
  count: number;
  children: ReactNode;
}) {
  if (count <= 0) return null;

  return (
    <section
      aria-label="Featured listings"
      className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-2 sm:p-2.5"
    >
      <div className="flex items-baseline justify-between gap-3 px-1 pb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-indigo-900">Featured</h2>
        <p className="text-[11px] text-indigo-800/80">
          Paid placement · {count}
        </p>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
