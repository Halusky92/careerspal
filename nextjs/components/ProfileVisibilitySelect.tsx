"use client";

import { useEffect, useRef, useState } from "react";

export type ProfileVisibility = "private" | "employers" | "link";

export const PROFILE_VISIBILITY_OPTIONS = [
  {
    id: "private" as const,
    title: "Only me",
    body: "Employers cannot view your profile.",
  },
  {
    id: "employers" as const,
    title: "Employers on CareersPal",
    body: "Signed-in employers can open your profile. You still apply on their job link.",
  },
  {
    id: "link" as const,
    title: "Anyone with my link",
    body: "Not listed. Only people you send the link to can open it.",
  },
] as const;

type Props = {
  value: ProfileVisibility;
  onChange: (next: ProfileVisibility) => void;
};

export default function ProfileVisibilitySelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const current = PROFILE_VISIBILITY_OPTIONS.find((opt) => opt.id === value) || PROFILE_VISIBILITY_OPTIONS[0];
  const others = PROFILE_VISIBILITY_OPTIONS.filter((opt) => opt.id !== value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="w-full rounded-xl border border-indigo-500 bg-indigo-50 px-3 py-2.5 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-slate-900">{current.title}</div>
            <div className="text-xs text-slate-500 mt-0.5">{current.body}</div>
          </div>
          <span className="text-slate-400 text-xs mt-1">{open ? "▴" : "▾"}</span>
        </div>
      </button>
      {open ? (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {others.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                onChange(opt.id);
                setOpen(false);
              }}
              className="w-full rounded-lg px-3 py-2.5 text-left hover:bg-slate-50"
            >
              <div className="text-sm font-medium text-slate-900">{opt.title}</div>
              <div className="text-xs text-slate-500 mt-0.5">{opt.body}</div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
