import React from "react";
import { formatSourcedDescription } from "../lib/sourcing/normalization/description";

type Block =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] };

const KNOWN_HEADINGS = new Set(
  [
    "who we are",
    "about the role",
    "about the team",
    "what you’ll do",
    "what you'll do",
    "responsibilities",
    "requirements",
    "qualifications",
    "preferred qualifications",
    "benefits",
    "compensation",
    "salary",
    "what we offer",
  ].map((s) => s.toLowerCase()),
);

function isHeadingLine(line: string): boolean {
  const t = (line || "").trim();
  if (!t) return false;
  const normalized = t.replace(/:$/, "").trim().toLowerCase();
  if (KNOWN_HEADINGS.has(normalized)) return true;
  if (t.endsWith(":") && t.length <= 64 && !t.includes(".")) return true;
  return false;
}

function parseBlocks(text: string): Block[] {
  const lines = (text || "").replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: string[] = [];

  const flushPara = () => {
    const joined = para.join(" ").replace(/\s+/g, " ").trim();
    if (joined) blocks.push({ kind: "paragraph", text: joined });
    para = [];
  };
  const flushList = () => {
    const items = list.map((x) => x.trim()).filter(Boolean);
    if (items.length) blocks.push({ kind: "list", items });
    list = [];
  };

  for (const raw of lines) {
    const line = (raw || "").trim();
    if (!line) {
      flushList();
      flushPara();
      continue;
    }

    if (isHeadingLine(line)) {
      flushList();
      flushPara();
      blocks.push({ kind: "heading", text: line.replace(/:$/, "").trim() });
      continue;
    }

    const bullet = line.match(/^-\s+(.*)$/);
    if (bullet) {
      flushPara();
      list.push(bullet[1].trim());
      continue;
    }

    flushList();
    para.push(line);
  }

  flushList();
  flushPara();
  return blocks;
}

export default function FormattedDescriptionStatic({
  text,
  maxLen,
  className,
}: {
  text: string | null | undefined;
  maxLen?: number;
  className?: string;
}) {
  const formatted = formatSourcedDescription((text || "").toString(), { maxLen });
  const blocks = parseBlocks(formatted);
  if (!blocks.length) return null;

  return (
    <div className={className || "space-y-4"}>
      {blocks.map((b, idx) => {
        if (b.kind === "heading") {
          return (
            <div key={`${b.kind}-${idx}`} className="pt-2">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">{b.text}</div>
            </div>
          );
        }
        if (b.kind === "list") {
          return (
            <ul key={`${b.kind}-${idx}`} className="list-disc pl-5 space-y-1 text-sm font-medium text-slate-700">
              {b.items.map((it, i) => (
                <li key={`${idx}-${i}`} className="leading-relaxed">
                  {it}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={`${b.kind}-${idx}`} className="text-sm font-medium text-slate-700 leading-relaxed">
            {b.text}
          </p>
        );
      })}
    </div>
  );
}

