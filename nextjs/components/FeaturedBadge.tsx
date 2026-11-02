import { featuredLabel } from "../lib/featuredListing";
import type { Job } from "../types";

export default function FeaturedBadge({
  job,
  size = "sm",
}: {
  job: Pick<Job, "planType" | "plan">;
  size?: "sm" | "md";
}) {
  const label = featuredLabel(job);
  if (!label) return null;
  const elite = label === "Elite";
  return (
    <span
      className={[
        "inline-flex items-center rounded-full font-semibold uppercase tracking-wide",
        size === "md" ? "px-2.5 py-1 text-[11px]" : "px-2 py-0.5 text-[10px]",
        elite
          ? "bg-slate-900 text-white"
          : "bg-indigo-600 text-white",
      ].join(" ")}
    >
      {label}
    </span>
  );
}
