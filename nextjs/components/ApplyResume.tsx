"use client";

import { useEffect } from "react";
import { useSupabaseAuth } from "./Providers";
import { openCompanyApply, takePendingApply } from "../lib/applyGate";
import { trackJobApply } from "../lib/trackJobEvent";

export default function ApplyResume() {
  const { accessToken, loading } = useSupabaseAuth();

  useEffect(() => {
    if (loading || !accessToken) return;
    const pending = takePendingApply();
    if (!pending) return;
    trackJobApply(pending.jobId);
    openCompanyApply(pending.applyUrl);
  }, [accessToken, loading]);

  return null;
}
