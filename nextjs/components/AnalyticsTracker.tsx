 "use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const getSessionId = () => {
  if (typeof window === "undefined") return "";
  const stored = window.localStorage.getItem("cp_sid");
  if (stored) return stored;
  const generated = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `sid_${Math.random().toString(36).slice(2)}${Date.now()}`;
  window.localStorage.setItem("cp_sid", generated);
  return generated;
};

const AnalyticsTracker = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const payload = {
      path: `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`,
      referrer: typeof document !== "undefined" ? document.referrer : "",
      sessionId: getSessionId(),
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    };

    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/analytics/track", blob);
      return;
    }

    fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      // noop
    });
  }, [pathname, searchParams]);

  return null;
};

export default AnalyticsTracker;
