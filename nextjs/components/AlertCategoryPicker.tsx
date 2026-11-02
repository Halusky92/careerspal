"use client";

import { CATEGORY_HUBS } from "../lib/categories";

export default function AlertCategoryPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const allOn = selected.includes("all") || selected.length >= CATEGORY_HUBS.length;

  const toggle = (slug: string) => {
    if (slug === "all") {
      onChange(["all"]);
      return;
    }
    const current = allOn ? [] : selected.filter((item) => item !== "all");
    const next = current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug];
    if (next.length === 0 || next.length >= CATEGORY_HUBS.length) onChange(["all"]);
    else onChange(next);
  };

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Categories</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => toggle("all")}
          aria-pressed={allOn}
          className={[
            "h-8 px-3 rounded-full border text-xs font-medium",
            allOn
              ? "bg-indigo-600 text-white border-indigo-600"
              : "bg-white text-slate-700 border-slate-200 hover:border-indigo-200",
          ].join(" ")}
        >
          All
        </button>
        {CATEGORY_HUBS.map((hub) => {
          const on = !allOn && selected.includes(hub.slug);
          return (
            <button
              key={hub.slug}
              type="button"
              onClick={() => toggle(hub.slug)}
              aria-pressed={on}
              className={[
                "h-8 px-3 rounded-full border text-xs font-medium",
                on
                  ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                  : "bg-white text-slate-700 border-slate-200 hover:border-indigo-200",
              ].join(" ")}
            >
              {hub.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
