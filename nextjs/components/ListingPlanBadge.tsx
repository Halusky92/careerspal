import type { Job } from "../types";
import { listingPlanInfo } from "../lib/listingPlan";

export default function ListingPlanBadge({
  job,
  packUsedByCompany,
  className = "",
}: {
  job: Job;
  packUsedByCompany?: Map<string, number>;
  className?: string;
}) {
  const info = listingPlanInfo(job, packUsedByCompany);
  if (!info) return null;
  const tone =
    info.kind === "free"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : info.kind === "paid"
        ? "border-indigo-200 bg-indigo-50 text-indigo-800"
        : "border-slate-200 bg-slate-50 text-slate-600";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone} ${className}`.trim()}
      title={info.kind === "free" ? "Start pack listings used by this company" : info.label}
    >
      {info.label}
    </span>
  );
}
