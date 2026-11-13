"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSupabaseAuth } from "./Providers";
import { authFetch } from "../lib/authFetch";
import type { PublicJobCard } from "../lib/publicListPreview";

export default function PremiumListContinuation({
  endpoint,
  knownIds,
  total,
  shown,
}: {
  endpoint: string;
  knownIds: string;
  total: number;
  shown: number;
}) {
  const { accessToken, loading } = useSupabaseAuth();
  const [extra, setExtra] = useState<PublicJobCard[]>([]);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      setExtra([]);
      setPaid(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const response = await authFetch(endpoint, { cache: "no-store" }, accessToken);
        if (!response.ok || cancelled) return;
        const data = (await response.json()) as { jobs?: PublicJobCard[]; access?: string };
        if (cancelled) return;
        const known = new Set(knownIds.split(",").filter(Boolean));
        const jobs = Array.isArray(data.jobs) ? data.jobs.filter((job) => job?.id && job.href && !known.has(job.id)) : [];
        setPaid(data.access === "paid");
        setExtra(jobs);
      } catch {
        if (!cancelled) {
          setExtra([]);
          setPaid(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, endpoint, knownIds]);

  const remaining = Math.max(0, total - shown - extra.length);

  return (
    <div className="mt-3">
      {extra.length > 0 ? (
        <ul className="space-y-2">
          {extra.map((job) => (
            <li key={job.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link href={job.href} className="block truncate text-sm font-semibold text-slate-900 hover:text-indigo-700">
                    {job.title}
                  </Link>
                  <div className="mt-0.5 truncate text-[12px] text-slate-500">
                    {[job.company, job.location].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="whitespace-nowrap text-sm font-medium text-slate-900">{job.salaryLabel}</div>
                  <Link href={job.href} className="mt-1 inline-flex text-xs font-medium text-indigo-700 hover:underline">
                    View role
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {!loading && !paid && remaining > 0 ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
          <p className="text-sm text-slate-700">
            {remaining} more live {remaining === 1 ? "role" : "roles"}. Premium unlocks the rest of this list. Each role page stays public.
          </p>
          <Link
            href={accessToken ? "/upgrade" : `/auth?from=${encodeURIComponent("/upgrade")}`}
            className="mt-2 inline-flex text-sm font-medium text-indigo-700 hover:underline"
          >
            Unlock the full board
          </Link>
        </div>
      ) : null}
    </div>
  );
}
