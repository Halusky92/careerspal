import { isNewListing } from "../lib/listingWindow";

export default function NewListingBadge({
  job,
}: {
  job: { timestamp?: number | null; publishedAt?: string | null; createdAt?: string | null };
}) {
  if (!isNewListing(job)) return null;
  return (
    <span className="inline-flex items-center rounded bg-[#f3e4bc] px-1 py-px text-[9px] font-normal uppercase tracking-wide text-slate-900">
      New
    </span>
  );
}
