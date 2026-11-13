import { stripHtmlToText } from "./text";
import { isBoilerplateDescription } from "../../companyBoard";

type FormatOpts = {
  maxLen?: number;
};

function decodeEntities(raw: string): string {
  return (raw || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&mdash;|&#8212;|&#x2014;/gi, "-")
    .replace(/&ndash;|&#8211;|&#x2013;/gi, "-")
    .replace(/&minus;|&#8722;|&#x2212;/gi, "-")
    .replace(/&#(\d+);/g, (_m, n) => {
      const code = Number(n);
      return Number.isFinite(code) && code > 0 && code < 0x10ffff ? String.fromCharCode(code) : "";
    })
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

const SECTION_HEADING_PHRASES = [
    "Who we are",
    "About the role",
    "About the team",
    "About you",
    "About us",
    "What you’ll do",
    "What you'll do",
    "What we're looking for",
    "What you will do",
    "What you bring",
    "What you'll bring",
    "Responsibilities",
    "Summary",
    "Full description",
    "About this job",
    "The role",
    "What you'll need",
    "What you’ll need",
    "Requirements",
    "Qualifications",
    "Preferred qualifications",
    "Nice to have",
    "Preferred",
    "Benefits",
    "Compensation",
    "Salary",
  "What we offer",
];

function normalizeSectionHeadings(out: string): string {
  let s = (out || "").toString();
  if (!s.trim()) return "";
  // A heading is a label on its own line. "The role combines…" and "Benefits for this role…"
  // stay sentences, because the words after the label continue the sentence.
  for (const h of SECTION_HEADING_PHRASES) {
    const safe = h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|\\n)\\s*(${safe})\\s*:?(?=\\s*(?:\\n|$))`, "gim");
    s = s.replace(re, (_m, p1, p2) => `${p1}\n\n${p2}:\n`);
  }
  return s.replace(/\n{3,}/g, "\n\n").trim();
}

function repairFalseHeadings(out: string): string {
  const labels = SECTION_HEADING_PHRASES
    .map((heading) => heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  return (out || "")
    .replace(new RegExp(`(^|\\n)(${labels}):\\n(?=[a-z])`, "g"), "$1$2 ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function dropSeparatorLines(out: string): string {
  return (out || "")
    .replace(/[ \t]*_{4,}[ \t]*/g, "\n")
    .split("\n")
    .filter((line) => !/^[_\-=*~.]{4,}$/.test(line.trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitDenseParagraphs(out: string): string {
  let s = (out || "").toString().replace(/\r\n/g, "\n");
  if (!s.trim()) return "";

  // If everything is still one giant block, split into readable paragraphs using sentence boundaries.
  const nonEmptyLines = s.split("\n").filter((l) => l.trim()).length;
  if (s.length < 900 || nonEmptyLines > 6) return s;

  const tokens = s
    .replace(/\s+/g, " ")
    .trim()
    // break after sentence end when next starts like a new sentence / section
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/g)
    .map((t) => t.trim())
    .filter(Boolean);

  if (tokens.length <= 2) return s;

  const paras: string[] = [];
  let current = "";
  for (const t of tokens) {
    const next = current ? `${current} ${t}` : t;
    if (next.length > 420 && current) {
      paras.push(current.trim());
      current = t;
    } else {
      current = next;
    }
  }
  if (current.trim()) paras.push(current.trim());

  return paras.join("\n\n");
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

function fingerprint(text: string): string {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isNearDuplicate(a: string, b: string): boolean {
  const x = fingerprint(a);
  const y = fingerprint(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.length > 80 && y.includes(x)) return true;
  if (y.length > 80 && x.includes(y)) return true;
  return false;
}

function dropVendorBlurbs(out: string): string {
  return (out || "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p && !isBoilerplateDescription(p))
    .join("\n\n");
}

function dedupeRepeatedChunks(out: string): string {
  const parts = (out || "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const kept: string[] = [];
  for (const part of parts) {
    if (kept.some((prev) => isNearDuplicate(prev, part))) continue;
    kept.push(part);
  }
  return dropVendorBlurbs(kept.join("\n\n"));
}

const DETAIL_SECTIONS: Array<{ heading: string; aliases: string[] }> = [
  { heading: "About the role", aliases: ["about the role", "the role", "summary", "about this job", "what we do", "about the team"] },
  { heading: "What you'll do", aliases: ["what you'll do", "what you’ll do", "what you will do", "responsibilities"] },
  { heading: "Requirements", aliases: ["requirements", "qualifications", "what you'll need", "what you’ll need", "who you are", "about you"] },
  { heading: "Benefits", aliases: ["benefits", "what we offer", "pay and benefits", "compensation"] },
];

function headingKey(line: string): string | null {
  const t = line.replace(/:$/, "").trim().toLowerCase();
  for (const section of DETAIL_SECTIONS) {
    if (section.aliases.includes(t)) return section.heading;
  }
  return null;
}

export function extractJobDetailSections(input: string): Array<{ heading: string; body: string }> {
  const text = formatSourcedDescription(input);
  if (!text.trim()) return [];
  const lines = text.split("\n");
  const blocks: Array<{ heading: string; body: string }> = [];
  let current = { heading: "About the role", body: "" };
  let sawNamed = false;
  for (const line of lines) {
    const key = headingKey(line.trim());
    if (key) {
      if (current.body.trim()) blocks.push({ heading: current.heading, body: current.body.trim() });
      current = { heading: key, body: "" };
      sawNamed = true;
      continue;
    }
    current.body = current.body ? `${current.body}\n${line}` : line;
  }
  if (current.body.trim()) blocks.push({ heading: current.heading, body: current.body.trim() });
  const merged = new Map<string, string>();
  for (const block of blocks) {
    const prev = merged.get(block.heading);
    merged.set(block.heading, prev ? `${prev}\n\n${block.body}` : block.body);
  }
  const ordered = DETAIL_SECTIONS.map((s) => {
    const body = merged.get(s.heading);
    return body ? { heading: s.heading, body } : null;
  }).filter((s): s is { heading: string; body: string } => Boolean(s));
  if (!sawNamed || ordered.length < 2) return [{ heading: "About the role", body: text }];
  return ordered;
}

export function formatSourcedDescription(input: string, opts: FormatOpts = {}): string {
  const maxLen = typeof opts.maxLen === "number" ? opts.maxLen : 18_000;
  const raw = decodeEntities((input || "").toString());
  if (!raw.trim()) return "";

  // If it doesn't look like HTML, keep as-is but normalize whitespace in a readable way.
  if (!looksLikeHtml(raw)) {
    const lines = raw
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((l) => l.replace(/\s+/g, " ").trim());
    let normalized = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    normalized = dropSeparatorLines(repairFalseHeadings(normalized));
    normalized = normalizeSectionHeadings(normalized);
    normalized = explodeInlineBullets(normalized).replace(/\n{3,}/g, "\n\n").trim();
    normalized = splitDenseParagraphs(normalized).replace(/\n{3,}/g, "\n\n").trim();
    normalized = dedupeRepeatedChunks(normalized);
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

  out = dropSeparatorLines(repairFalseHeadings(out));
  out = normalizeSectionHeadings(out);
  out = explodeInlineBullets(out).replace(/\n{3,}/g, "\n\n").trim();
  out = splitDenseParagraphs(out).replace(/\n{3,}/g, "\n\n").trim();
  out = dedupeRepeatedChunks(out);

  // If we somehow lost structure and got very dense text, fall back to the plain stripper.
  // (Still conservative: just readable text.)
  const lineCount = out.split("\n").filter((l) => l.trim()).length;
  if (out.length > 800 && lineCount <= 2) {
    const flat = stripHtmlToText(raw);
    out = explodeInlineBullets(normalizeSectionHeadings(dropSeparatorLines(repairFalseHeadings(flat)))).replace(/\n{3,}/g, "\n\n").trim();
    out = splitDenseParagraphs(out).replace(/\n{3,}/g, "\n\n").trim();
    out = dedupeRepeatedChunks(out);
  }

  return out.length > maxLen ? `${out.slice(0, maxLen).trim()}…` : out;
}

