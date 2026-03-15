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
  // Avoid false positives (e.g. "3 < 5 and 5 > 3") by requiring something tag-like.
  if (/<\/?[a-z][\s\S]*?>/i.test(t)) return true;
  if (/&lt;\/?[a-z]/i.test(t)) return true;
  return false;
}

function normalizeSectionHeadings(out: string): string {
  let s = (out || "").toString();
  if (!s.trim()) return "";
  // Normalize common inline section headings into standalone lines (grounded: only if the phrase exists).
  // This helps turn "Who we are ... What you'll do: ..." into readable sections.
  const headings = [
    "Who we are",
    "About the role",
    "About the team",
    "What you’ll do",
    "What you'll do",
    "Responsibilities",
    "Requirements",
    "Qualifications",
    "Preferred qualifications",
    "Benefits",
    "Compensation",
    "Salary",
    "What we offer",
  ];
  for (const h of headings) {
    const safe = h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|\\n|\\.|\\!|\\?)\\s*(${safe})\\s*:?\\s+`, "gi");
    s = s.replace(re, (_m, p1, p2) => `${p1}\n\n${p2}:\n`);
  }
  return s.replace(/\n{3,}/g, "\n\n").trim();
}

function explodeInlineBullets(out: string): string {
  let s = (out || "").toString();
  if (!s.trim()) return "";

  // Convert inline bullet separators into real list items.
  // Examples:
  // "What you'll do: • Build X • Own Y" -> "What you'll do:\n- Build X\n- Own Y"
  const bulletChars = "•·‣▪●○";
  const reAfterPunct = new RegExp(`([:\\;\\.\\!\\?\\)])\\s*[${bulletChars}]\\s+`, "g");
  s = s.replace(reAfterPunct, "$1\n- ");

  const reAnywhere = new RegExp(`\\s*[${bulletChars}]\\s+`, "g");
  s = s.replace(reAnywhere, "\n- ");

  // Also handle common inline hyphen bullets after a label, e.g. "Responsibilities: - A - B"
  s = s.replace(/:\s*-\s+/g, ":\n- ");
  s = s.replace(/\n-\s+-\s+/g, "\n- ");

  return s;
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
    let normalized = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    normalized = normalizeSectionHeadings(normalized);
    normalized = explodeInlineBullets(normalized).replace(/\n{3,}/g, "\n\n").trim();
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

  out = normalizeSectionHeadings(out);
  out = explodeInlineBullets(out).replace(/\n{3,}/g, "\n\n").trim();

  // If we somehow lost structure and got very dense text, fall back to the plain stripper.
  // (Still conservative: just readable text.)
  const lineCount = out.split("\n").filter((l) => l.trim()).length;
  if (out.length > 800 && lineCount <= 2) {
    const flat = stripHtmlToText(raw);
    out = explodeInlineBullets(normalizeSectionHeadings(flat)).replace(/\n{3,}/g, "\n\n").trim();
  }

  return out.length > maxLen ? `${out.slice(0, maxLen).trim()}…` : out;
}

