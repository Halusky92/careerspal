import { stripHtmlToText } from "./text";

type FormatOpts = {
  maxLen?: number;
};

function decodeEntities(raw: string): string {
  // Minimal, safe decoding (same approach as stripHtmlToText, but we preserve newlines).
  return (raw || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&mdash;|&#8212;|&#x2014;/gi, "-")
    .replace(/&ndash;|&#8211;|&#x2013;/gi, "-")
    .replace(/&minus;|&#8722;|&#x2212;/gi, "-")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function looksLikeHtml(text: string): boolean {
  const t = (text || "").trim();
  if (!t) return false;
  if (t.includes("<") && t.includes(">")) return true;
  if (t.includes("&lt;") && t.includes("&gt;")) return true;
  return false;
}

export function formatSourcedDescription(input: string, opts: FormatOpts = {}): string {
  const maxLen = typeof opts.maxLen === "number" ? opts.maxLen : 18_000;
  const raw = (input || "").toString();
  if (!raw.trim()) return "";

  // If it doesn't look like HTML, keep as-is but normalize whitespace in a readable way.
  if (!looksLikeHtml(raw)) {
    const lines = raw
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((l) => l.replace(/\s+/g, " ").trim());
    const normalized = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    return normalized.length > maxLen ? `${normalized.slice(0, maxLen).trim()}…` : normalized;
  }

  // 1) Remove scripts/styles.
  let s = raw.replace(/<script[\s\S]*?<\/script>/gi, "\n").replace(/<style[\s\S]*?<\/style>/gi, "\n");

  // 2) Decode escaped HTML entities first (some sources double-escape).
  s = decodeEntities(s);
  if (s.includes("&lt;") || s.includes("&gt;")) s = decodeEntities(s);

  // 3) Convert common structural tags into newlines/bullets BEFORE stripping tags.
  s = s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|header|footer|table|thead|tbody|tr|blockquote)>/gi, "\n\n")
    .replace(/<(p|div|section|article|header|footer|table|thead|tbody|tr|blockquote)(\s+[^>]*)?>/gi, "\n\n")
    .replace(/<hr(\s+[^>]*)?>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<h[1-6](\s+[^>]*)?>/gi, "\n\n")
    .replace(/<\/(ul|ol)>/gi, "\n\n")
    .replace(/<(ul|ol)(\s+[^>]*)?>/gi, "\n\n")
    .replace(/<li(\s+[^>]*)?>/gi, "\n- ")
    .replace(/<\/li>/gi, "\n");

  // 4) Strip remaining tags.
  s = s.replace(/<[^>]+>/g, " ");

  // 5) Normalize line whitespace while preserving paragraphs & bullets.
  const lines = s
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => {
      const t = line.trim();
      if (!t) return "";
      // Preserve a bullet marker if present.
      const bulletMatch = t.match(/^[-*•]\s+(.*)$/);
      if (bulletMatch) return `- ${bulletMatch[1].replace(/\s+/g, " ").trim()}`;
      return t.replace(/\s+/g, " ").trim();
    });

  let out = lines.join("\n");
  // Collapse too many blank lines.
  out = out.replace(/\n{3,}/g, "\n\n").trim();

  // If we somehow lost structure and got very dense text, fall back to the plain stripper.
  // (Still conservative: just readable text.)
  const lineCount = out.split("\n").filter((l) => l.trim()).length;
  if (out.length > 800 && lineCount <= 2) {
    out = stripHtmlToText(raw);
  }

  return out.length > maxLen ? `${out.slice(0, maxLen).trim()}…` : out;
}

