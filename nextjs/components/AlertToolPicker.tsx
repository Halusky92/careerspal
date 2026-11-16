import { POSTING_TOOLS, toggleTool } from "../lib/postingTools";

export default function AlertToolPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Tools on the role</span>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {POSTING_TOOLS.map((tool) => {
          const active = selected.some((item) => item.toLowerCase() === tool.toLowerCase());
          return (
            <button
              key={tool}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(toggleTool(selected, tool))}
              className={`h-8 rounded-full border px-3 text-xs font-medium ${
                active ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-indigo-200"
              }`}
            >
              {tool}
            </button>
          );
        })}
      </div>
    </div>
  );
}
