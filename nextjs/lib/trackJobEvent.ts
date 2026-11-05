"use client";

import { classifyListingSource } from "./listingTraffic";
import { supabase } from "./supabaseClient";

const sessionId = () => {
  if (typeof window === "undefined") return "";
  const stored = window.localStorage.getItem("cp_sid");
  if (stored) return stored;
  const generated =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `sid_${Math.random().toString(36).slice(2)}${Date.now()}`;
  window.localStorage.setItem("cp_sid", generated);
  return generated;
};

const payloadFor = (kind: "view" | "apply") => {
  const params = new URLSearchParams(window.location.search);
  const source = classifyListingSource({
    path: window.location.pathname,
    referrer: document.referrer,
    utm: params.get("utm_source") || params.get("ref"),
  });
  return {
    kind,
    source: kind === "apply" && window.location.pathname === "/jobs" ? "board" : source,
    referrer: document.referrer || "",
    path: `${window.location.pathname}${window.location.search || ""}`,
    sessionId: sessionId(),
  };
};

const postEvent = (jobId: string, kind: "view" | "apply") => {
  if (!jobId) return;
  const url = kind === "view" ? `/api/jobs/${jobId}/view` : `/api/jobs/${jobId}/match`;
  const body = JSON.stringify(payloadFor(kind));
  void (async () => {
    let token = "";
    try {
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token || "";
    } catch {
      token = "";
    }
    if (token) {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body,
        keepalive: true,
      }).catch(() => undefined);
      return;
    }
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
      return;
    }
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  })();
};

export const trackJobView = (jobId: string) => {
  if (typeof window === "undefined" || !jobId) return;
  const key = `cp_view_${jobId}_${sessionId()}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    // ignore
  }
  postEvent(jobId, "view");
};

export const trackJobApply = (jobId: string) => {
  if (!jobId) return;
  postEvent(jobId, "apply");
};
