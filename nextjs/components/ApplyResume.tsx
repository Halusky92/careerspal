"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSupabaseAuth } from "./Providers";
import {
  APPLY_BLOCKED_EVENT,
  openCompanyApply,
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
    if (pathname.startsWith("/auth")) return;
    const pending = takePendingApply();
    if (!pending) return;
    trackJobApply(pending.jobId);
    const opened = openCompanyApply(pending.applyUrl);
    if (!opened) setBlocked(pending);
  }, [accessToken, loading, pathname]);

  if (!blocked) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 z-40 mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-lg">
      <p className="text-sm font-medium text-slate-900">Continue on the employer site</p>
      <p className="mt-0.5 text-xs text-slate-500">This CareersPal page stays open. The apply form opens in a new tab.</p>
      <a
        href={blocked.applyUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => setBlocked(null)}
        className="mt-3 inline-flex h-9 items-center rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-indigo-700"
      >
        Open apply page
      </a>
    </div>
  );
}
