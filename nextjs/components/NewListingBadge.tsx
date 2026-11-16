import { isPriorityListing } from "../lib/listingWindow";

export default function NewListingBadge({
  job,
}: {
  job: { timestamp?: number | null; publishedAt?: string | null; createdAt?: string | null };
}) {
  if (!isPriorityListing(job)) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
      New
    </span>
  );
}
