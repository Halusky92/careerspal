"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function CompanyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Helpful for local debugging; in prod Next omits details but keeps a digest.
    console.error(error);
  }, [error]);

  return (
    <div className="bg-[#F8F9FD] min-h-screen">
      <div className="max-w-3xl mx-auto px-6 pt-20 pb-24">
        <div className="rounded-[2.75rem] border border-slate-200/60 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.06)] p-10 text-center">
          <h1 className="text-4xl font-black text-slate-900 mb-4">Something went wrong</h1>
          <p className="text-slate-500 font-medium mb-8">
            This company page hit an unexpected issue. Please try again.
          </p>

          {error?.digest ? (
            <div className="mb-8">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Error digest</div>
              <div className="mt-2 font-mono text-xs text-slate-700 break-all">{error.digest}</div>
              <p className="mt-3 text-xs text-slate-500">
                Send this digest to support so we can pinpoint the server error.
              </p>
            </div>
          ) : null}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={reset}
              className="inline-flex items-center justify-center px-8 py-4 rounded-2xl bg-indigo-600 text-white font-black shadow-xl shadow-indigo-100"
            >
              Reload page
            </button>
            <Link
              href="/jobs"
              className="inline-flex items-center justify-center px-8 py-4 rounded-2xl bg-white border border-slate-200 text-slate-800 font-black hover:border-indigo-200 hover:text-indigo-700 transition-colors"
            >
              Back to jobs
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

