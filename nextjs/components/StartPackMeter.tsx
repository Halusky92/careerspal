"use client";

import { FOUNDING_JOBS_PER_COMPANY, START_PACK_NEXT_PRICE, type StartPackStatus } from "../lib/founding";

const slotClass = (index: number, used: number) => {
  if (index >= used) return "bg-white border border-slate-200";
  if (index < 4) return "bg-emerald-400 border border-emerald-500";
  if (index < 7) return "bg-teal-500 border border-teal-600";
  if (index < 9) return "bg-amber-400 border border-amber-500";
  return "bg-orange-500 border border-orange-600";
};

export default function StartPackMeter({
  status,
  pendingUse = false,
}: {
  status: Pick<StartPackStatus, "enabled" | "eligible" | "remainingJobs" | "usedJobs" | "quota" | "nextPrice" | "reason"> | null;
  pendingUse?: boolean;
}) {
  if (!status?.enabled) return null;
  const quota = status.quota || FOUNDING_JOBS_PER_COMPANY;
  const used = Math.min(quota, Math.max(0, status.usedJobs || 0));
  const remaining = Math.max(0, status.remainingJobs ?? quota - used);
  const shownUsed = pendingUse && remaining > 0 ? Math.min(quota, used + 1) : used;
  const remainingAfter = pendingUse ? Math.max(0, remaining - 1) : remaining;
  const nextPrice = status.nextPrice || START_PACK_NEXT_PRICE;
  const closedNew = status.reason === "no_slots" && !status.eligible;
  const depleted = remaining === 0 || status.reason === "job_cap" || status.reason === "company_cap" || status.reason === "account_cap";
  const low = !depleted && !closedNew && remainingAfter <= 2;

  const shell = closedNew || depleted
    ? "border-slate-200 bg-slate-50"
    : low
      ? "border-amber-200 bg-amber-50"
      : "border-emerald-200 bg-emerald-50";

  const headline = closedNew
    ? "Start pack is not open for new companies."
    : depleted
      ? status.reason === "company_cap"
        ? `This company already used its free listing. Next is $${nextPrice}.`
        : `Start pack used. Next listing is $${nextPrice}.`
      : remaining === 1
        ? `Last free listing. Then $${nextPrice}.`
        : `${remaining} free left, then $${nextPrice}.`;

  const detail = depleted
    ? `${quota} of ${quota} free Standard listing${quota === 1 ? "" : "s"} used.`
    : pendingUse
      ? `This listing is #${shownUsed} of ${quota}. After submit: ${remainingAfter} free left.`
      : `${used} of ${quota} used.`;

  return (
    <div className={`rounded-xl border px-4 py-3 ${shell}`}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">Start pack</p>
        <p className={`text-sm font-medium ${depleted ? "text-slate-700" : low ? "text-amber-900" : "text-emerald-900"}`}>
          {headline}
        </p>
      </div>
      <div className="mt-2.5 flex gap-1" aria-hidden>
        {Array.from({ length: quota }, (_, index) => (
          <div
            key={index}
            className={`h-2.5 flex-1 rounded-full transition-colors ${slotClass(index, shownUsed)} ${
              pendingUse && index === used ? "ring-2 ring-offset-1 ring-emerald-300" : ""
            }`}
            title={`Listing ${index + 1}${index < shownUsed ? " used" : " free"}`}
          />
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">{detail} Reviewed before publish.</p>
    </div>
  );
}
