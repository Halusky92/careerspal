import { listingAgeBadge } from "../lib/listingWindow";

export default function NewListingBadge({
  job,
}: {
  job: {
    timestamp?: number | null;
    publishedAt?: string | null;
    createdAt?: string | null;
    published_at?: string | null;
    created_at?: string | null;
  };
}) {
  const mark = listingAgeBadge(job);
  if (mark === "premium") {
    return (
      <span className="inline-flex items-center rounded bg-[#e4c56a] px-1 py-px text-[9px] font-normal uppercase tracking-wide text-slate-950">
        Premium
      </span>
    );
  }
  if (mark === "new") {
    return (
      <span className="inline-flex items-center rounded bg-[#f3e4bc] px-1 py-px text-[9px] font-normal uppercase tracking-wide text-slate-900">
        New
      </span>
    );
  }
  return null;
}
