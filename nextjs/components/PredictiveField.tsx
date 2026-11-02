"use client";

import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type SuggestItem = { id: string; label: string; hint?: string };

type PredictiveFieldProps = {
  value: string;
  onChange: (value: string) => void;
  onPick?: (value: string) => void;
  kind?: "query" | "location";
  placeholder?: string;
  ariaLabel?: string;
  inputClassName?: string;
  name?: string;
};

export default function PredictiveField({
  value,
  onChange,
  onPick,
  kind = "query",
  placeholder,
  ariaLabel,
  inputClassName,
  name,
}: PredictiveFieldProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SuggestItem[]>([]);
  const [active, setActive] = useState(0);
  const [box, setBox] = useState<DOMRect | null>(null);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      setItems([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/jobs/suggest?kind=${kind}&q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { items?: SuggestItem[] };
        if (!cancelled) {
          setItems(Array.isArray(data.items) ? data.items : []);
          setActive(0);
        }
      } catch {
        if (!cancelled) setItems([]);
      }
    }, 160);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [value, kind]);

  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      if (rootRef.current) setBox(rootRef.current.getBoundingClientRect());
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, items.length, value]);

  useEffect(() => {
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      const list = document.getElementById(listId);
      if (list?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [listId]);

  const ghost = useMemo(() => {
    const typed = value;
    if (!typed || items.length === 0) return "";
    const match = items.find((item) => item.label.toLowerCase().startsWith(typed.toLowerCase()));
    if (!match) return "";
    return match.label.slice(typed.length);
  }, [items, value]);

  const apply = (label: string) => {
    onChange(label);
    onPick?.(label);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative min-w-0 flex-1">
      <div className="relative">
        <div
          className="pointer-events-none absolute inset-0 flex items-center px-3 sm:px-2 text-sm text-slate-900 overflow-hidden"
          aria-hidden
        >
          <span className="invisible whitespace-pre">{value || " "}</span>
          <span className="text-slate-400 whitespace-pre">{open ? ghost : ""}</span>
        </div>
        <input
          name={name}
          value={value}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open && items.length > 0}
          autoComplete="off"
          spellCheck={false}
          className={inputClassName}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              setOpen(false);
              return;
            }
            if (!open || items.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => (i + 1) % items.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => (i - 1 + items.length) % items.length);
            } else if (e.key === "Tab" && ghost) {
              e.preventDefault();
              apply(value + ghost);
            } else if (e.key === "Enter" && open && items[active]) {
              e.preventDefault();
              apply(items[active].label);
            }
          }}
        />
      </div>
      {open && items.length > 0 && box && typeof document !== "undefined"
        ? createPortal(
            <ul
              id={listId}
              role="listbox"
              className="fixed z-[220] max-h-64 overflow-auto rounded-xl border-2 border-slate-900 bg-white py-1 shadow-lg"
              style={{ top: box.bottom + 6, left: box.left, width: Math.max(box.width, 240) }}
            >
              {items.map((item, index) => (
                <li key={item.id} role="option" aria-selected={index === active}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => apply(item.label)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm ${
                      index === active ? "bg-slate-100 text-slate-900" : "text-slate-800 hover:bg-slate-50"
                    }`}
                  >
                    <span className="truncate font-medium">{item.label}</span>
                    {item.hint ? <span className="shrink-0 text-[11px] text-slate-600">{item.hint}</span> : null}
                  </button>
                </li>
              ))}
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}
