"use client";

import { useEffect, useState } from "react";
import { useSupabaseAuth } from "./Providers";
import { applyLinkReady, goToCompanyApply, peekPendingApply, takePendingApply } from "../lib/applyGate";
import { trackJobApply } from "../lib/trackJobEvent";

export default function ApplyContinue() {
  const { accessToken, loading } = useSupabaseAuth();
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (loading) return;
    const pending = peekPendingApply();
    if (!pending || !applyLinkReady(pending.applyUrl)) {
      setMissing(true);
      return;
    }
    if (!accessToken) return;
    const taken = takePendingApply();
    if (!taken) {
      setMissing(true);
      return;
    }
    trackJobApply(taken.jobId);
    goToCompanyApply(taken.applyUrl);
  }, [accessToken, loading]);

  if (missing) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <p className="text-sm text-slate-500">This apply tab has nothing waiting. You can close it and stay on CareersPal.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-24 text-center">
      <p className="text-sm font-medium text-slate-900">Waiting for sign in</p>
      <p className="mt-2 text-sm text-slate-500">
        Finish login on the other tab. This tab will open the employer apply page. CareersPal stays on the first tab.
      </p>
    </div>
  );
}
