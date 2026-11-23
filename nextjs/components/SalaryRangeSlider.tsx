"use client";

import { useEffect, useRef, useState } from "react";

export const SALARY_SLIDER_CAP = 500000;
export const SALARY_SLIDER_STEP = 10000;

function money(value: number) {
  if (value <= 0) return "Any";
  return `$${Math.round(value / 1000)}k`;
}

function snap(value: number) {
  const stepped = Math.round(value / SALARY_SLIDER_STEP) * SALARY_SLIDER_STEP;
  return Math.min(SALARY_SLIDER_CAP, Math.max(0, stepped));
}

export default function SalaryRangeSlider({
  min,
  max,
  onChange,
  onClear,
  marked = false,
}: {
  min: number;
  max: number;
  onChange: (min: number, max: number) => void;
  onClear?: () => void;
  marked?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<"min" | "max" | null>(null);
  const [left, setLeft] = useState(() => Math.min(Math.max(0, min), SALARY_SLIDER_CAP));
  const [right, setRight] = useState(() => (max > 0 ? Math.min(max, SALARY_SLIDER_CAP) : SALARY_SLIDER_CAP));
  const leftRef = useRef(left);
  const rightRef = useRef(right);
  leftRef.current = left;
  rightRef.current = right;

  useEffect(() => {
    if (dragRef.current) return;
    const nextRight = max > 0 ? Math.min(max, SALARY_SLIDER_CAP) : SALARY_SLIDER_CAP;
    setLeft(Math.min(Math.max(0, min), nextRight));
    setRight(nextRight);
  }, [min, max]);

  const openEnded = right >= SALARY_SLIDER_CAP;
  const capLabel = `$${Math.round(SALARY_SLIDER_CAP / 1000)}k`;
  const label =
    left <= 0 && openEnded ? "Any listed salary" : `${money(left)} – ${openEnded ? `${capLabel}+` : money(right)}`;

  const commit = (nextLeft: number, nextRight: number) => {
    onChange(nextLeft, nextRight >= SALARY_SLIDER_CAP ? 0 : nextRight);
  };

  const valueFromClientX = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return 0;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return snap(ratio * SALARY_SLIDER_CAP);
  };

  const moveThumb = (which: "min" | "max", clientX: number) => {
    const next = valueFromClientX(clientX);
    if (which === "min") {
      const value = Math.min(next, rightRef.current);
      leftRef.current = value;
      setLeft(value);
      return;
    }
    const value = Math.max(next, leftRef.current);
    rightRef.current = value;
    setRight(value);
  };

  const endDrag = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    commit(leftRef.current, rightRef.current);
  };

  const onThumbKey = (which: "min" | "max") => (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const direction = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 0;
    if (!direction) return;
    event.preventDefault();
    if (which === "min") {
      const next = Math.min(right, Math.max(0, left + direction * SALARY_SLIDER_STEP));
      setLeft(next);
      commit(next, right);
      return;
    }
    const next = Math.max(left, Math.min(SALARY_SLIDER_CAP, right + direction * SALARY_SLIDER_STEP));
    setRight(next);
    commit(left, next);
  };

  const leftPct = (left / SALARY_SLIDER_CAP) * 100;
  const rightPct = (right / SALARY_SLIDER_CAP) * 100;

  return (
    <div>
      <div className="text-[11px] font-medium text-slate-700">Salary range</div>
      <div className={["relative mt-2 pr-9 text-sm font-medium text-slate-900", marked ? "rounded-xl border border-indigo-500 px-3 py-2 shadow-[0_0_0_3px_rgba(79,70,229,0.14)]" : ""].join(" ")}>
        {label}
        {onClear ? (
          <button
            type="button"
            aria-label="Clear salary"
            onClick={onClear}
            className="absolute right-0 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-base leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ×
          </button>
        ) : null}
      </div>
      <div
        ref={trackRef}
        className="relative mt-3 h-8 touch-none"
        onPointerMove={(event) => {
          if (!dragRef.current) return;
          moveThumb(dragRef.current, event.clientX);
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-slate-300" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-indigo-600"
          style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }}
        />
        <button
          type="button"
          role="slider"
          aria-label="Minimum salary"
          aria-valuemin={0}
          aria-valuemax={SALARY_SLIDER_CAP}
          aria-valuenow={left}
          aria-valuetext={money(left)}
          onPointerDown={(event) => {
            event.preventDefault();
            dragRef.current = "min";
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onLostPointerCapture={endDrag}
          onKeyDown={onThumbKey("min")}
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-indigo-600 shadow-[0_0_0_1px_#c7d2fe]"
          style={{ left: `${leftPct}%`, zIndex: dragRef.current === "min" ? 2 : 1 }}
        />
        <button
          type="button"
          role="slider"
          aria-label="Maximum salary"
          aria-valuemin={0}
          aria-valuemax={SALARY_SLIDER_CAP}
          aria-valuenow={right}
          aria-valuetext={openEnded ? `${capLabel} or more` : money(right)}
          onPointerDown={(event) => {
            event.preventDefault();
            dragRef.current = "max";
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onLostPointerCapture={endDrag}
          onKeyDown={onThumbKey("max")}
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-indigo-600 shadow-[0_0_0_1px_#c7d2fe]"
          style={{ left: `${rightPct}%`, zIndex: dragRef.current === "max" ? 2 : 1 }}
        />
      </div>
    </div>
  );
}
