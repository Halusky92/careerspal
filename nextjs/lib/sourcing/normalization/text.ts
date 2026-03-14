export function stripHtmlToText(html: string): string {
  const raw = (html || "").toString();
  if (!raw) return "";
  // Remove scripts/styles.
  const noScripts = raw.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  // Replace tags with spaces.
  const noTags = noScripts.replace(/<[^>]+>/g, " ");
  // Decode a few common HTML entities (minimal, safe).
  const decoded = noTags
    .replace(/&nbsp;/g, " ")
    // Normalize common dash entities so salary ranges like "$120k &mdash; $150k" can be parsed.
    .replace(/&mdash;|&#8212;|&#x2014;/gi, "-")
    .replace(/&ndash;|&#8211;|&#x2013;/gi, "-")
    .replace(/&minus;|&#8722;|&#x2212;/gi, "-")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return decoded.replace(/\s+/g, " ").trim();
}

export function extractCompensationSnippet(text: string): string | null {
  const t = (text || "").trim();
  if (!t) return null;
  // Heuristic: capture a short window after common headings.
  const markers = ["compensation", "salary", "pay", "base salary", "what we offer"];
  const lower = t.toLowerCase();
  for (const m of markers) {
    const idx = lower.indexOf(m);
    if (idx === -1) continue;
    const window = t.slice(idx, Math.min(t.length, idx + 600));
    return window.trim();
  }
  return null;
}

