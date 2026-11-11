export function stripHtmlToText(html: string): string {
  const raw = (html || "").toString();
  if (!raw) return "";
  // Remove scripts/styles.
  const noScripts = raw.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  // Decode a few common HTML entities (minimal, safe).
  // NOTE: Some ATS payloads contain HTML that is itself escaped (e.g. "&lt;div&gt;...").
  // We decode first, then strip tags, then normalize whitespace.
  let decoded = noScripts;
  for (let pass = 0; pass < 2; pass += 1) {
    decoded = decoded
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&mdash;|&#8212;|&#x2014;/gi, "-")
      .replace(/&ndash;|&#8211;|&#x2013;/gi, "-")
      .replace(/&minus;|&#8722;|&#x2212;/gi, "-")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'");
  }

  // Replace tags with spaces (after decoding, to handle escaped HTML).
  const noTags = decoded.replace(/<[^>]+>/g, " ");
  return noTags.replace(/\s+/g, " ").trim();
}

export function extractCompensationSnippet(text: string): string | null {
  const t = (text || "").trim();
  if (!t) return null;
  // Heuristic: capture a short window after common headings.
  const markers = ["base salary", "on-target earnings", "salary range", "what we offer", "compensation", "salary", "pay"];
  const lower = t.toLowerCase();
  for (const m of markers) {
    const idx = lower.indexOf(m);
    if (idx === -1) continue;
    const window = t.slice(idx, Math.min(t.length, idx + 600));
    return window.trim();
  }
  return null;
}

