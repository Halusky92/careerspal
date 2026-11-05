"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSupabaseAuth } from "./Providers";
import {
  APPLY_BLOCKED_EVENT,
  openCompanyApply,
  peekPendingApply,
  takePendingApply,
  type PendingApply,
} from "../lib/applyGate";
import { trackJobApply } from "../lib/trackJobEvent";

export default function ApplyResume() {
  const pathname = usePathname();
  const { accessToken, loading } = useSupabaseAuth();
  const [blocked, setBlocked] = useState<PendingApply | null>(null);

  useEffect(() => {
    const onBlocked = (event: Event) => {
      const detail = (event as CustomEvent<PendingApply>).detail;
      if (detail?.applyUrl) setBlocked(detail);
    };
    window.addEventListener(APPLY_BLOCKED_EVENT, onBlocked);
    return () => window.removeEventListener(APPLY_BLOCKED_EVENT, onBlocked);
  }, []);

  useEffect(() => {
    if (loading || !accessToken) return;
    if (pathname.startsWith("/auth") || pathname.startsWith("/apply/continue")) return;
    const pending = peekPendingApply();
    if (!pending) return;
    const returnPath = (pending.returnTo || "/").split("?")[0];
    if (returnPath.startsWith("/jobs") && !pathname.startsWith("/jobs")) return;
    trackJobApply(pending.jobId);
    const opened = openCompanyApply(pending.applyUrl);
    if (opened) {
      takePendingApply();
      setBlocked(null);
      return;
    }
    setBlocked(pending);
  }, [accessToken, loading, pathname]);

  if (!blocked) return null;
  if (pathname.startsWith("/auth") || pathname.startsWith("/apply/continue")) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <p className="text-lg font-semibold text-slate-900">Open the employer apply page</p>
        <p className="mt-2 text-sm text-slate-500">
          This tab stays on the job. The employer apply page opens in front.
        </p>
        <a
          href={blocked.applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            takePendingApply();
            setBlocked(null);
          }}
          className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Open apply page
        </a>
      </div>
    </div>
  );
}
