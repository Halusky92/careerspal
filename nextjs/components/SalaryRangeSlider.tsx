"use client";

export const SALARY_SLIDER_CAP = 500000;
export const SALARY_SLIDER_STEP = 10000;

function money(value: number) {
  if (value <= 0) return "Any";
  return `$${Math.round(value / 1000)}k`;
}

export default function SalaryRangeSlider({
  min,
  max,
  onChange,
}: {
  min: number;
  max: number;
  onChange: (min: number, max: number) => void;
}) {
  const right = max > 0 ? Math.min(max, SALARY_SLIDER_CAP) : SALARY_SLIDER_CAP;
  const left = Math.min(Math.max(0, min), right);
  const openEnded = right >= SALARY_SLIDER_CAP;
  const capLabel = `$${Math.round(SALARY_SLIDER_CAP / 1000)}k`;
  const label =
    left <= 0 && openEnded ? "Any listed salary" : `${money(left)} – ${openEnded ? `${capLabel}+` : money(right)}`;

  return (
    <div>
      <div className="text-[11px] font-medium text-slate-700">Salary range</div>
      <div className="mt-2 text-sm font-medium text-slate-900">{label}</div>
      <div className="relative mt-3 h-6">
        <style>{`
          .cp-salary-range { pointer-events: none; appearance: none; background: transparent; }
          .cp-salary-range::-webkit-slider-runnable-track { height: 4px; background: #cbd5e1; border-radius: 999px; }
          .cp-salary-range::-moz-range-track { height: 4px; background: #cbd5e1; border-radius: 999px; }
          .cp-salary-range::-webkit-slider-thumb { pointer-events: auto; appearance: none; height: 16px; width: 16px; margin-top: -6px; border-radius: 999px; background: #4f46e5; border: 2px solid white; box-shadow: 0 0 0 1px #c7d2fe; cursor: pointer; }
          .cp-salary-range::-moz-range-thumb { pointer-events: auto; height: 16px; width: 16px; border-radius: 999px; background: #4f46e5; border: 2px solid white; cursor: pointer; }
        `}</style>
        <input
          className="cp-salary-range absolute inset-x-0 top-1 w-full"
          type="range"
          min={0}
          max={SALARY_SLIDER_CAP}
          step={SALARY_SLIDER_STEP}
          value={left}
          aria-label="Minimum salary"
          aria-valuetext={money(left)}
          onChange={(event) => {
            const next = Math.min(Number(event.target.value), right);
            onChange(next, openEnded ? 0 : right);
          }}
        />
        <input
          className="cp-salary-range absolute inset-x-0 top-1 w-full"
          type="range"
          min={0}
          max={SALARY_SLIDER_CAP}
          step={SALARY_SLIDER_STEP}
          value={right}
          aria-label="Maximum salary"
          aria-valuetext={openEnded ? `${capLabel} or more` : money(right)}
          onChange={(event) => {
            const next = Math.max(Number(event.target.value), left);
            onChange(left, next >= SALARY_SLIDER_CAP ? 0 : next);
          }}
        />
      </div>
    </div>
  );
}
