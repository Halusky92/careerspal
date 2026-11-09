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

export function trackFunnel(event: string, extra?: Record<string, string | number | boolean | null>) {
  if (typeof window === "undefined" || !event) return;
  const payload = {
    event,
    path: `${window.location.pathname}${window.location.search || ""}`,
    referrer: document.referrer || "",
    sessionId: sessionId(),
    userAgent: navigator.userAgent || "",
    extra: extra || null,
  };
  const body = JSON.stringify(payload);
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/analytics/track", new Blob([body], { type: "application/json" }));
    return;
  }
  fetch("/api/analytics/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

export function trackFunnelOnce(event: string, extra?: Record<string, string | number | boolean | null>) {
  if (typeof window === "undefined") return;
  const key = `cp_funnel_${event}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    // still send
  }
  trackFunnel(event, extra);
}
