import { isNewListing } from "../lib/listingWindow";

export default function NewListingBadge({
  job,
}: {
  job: { timestamp?: number | null; publishedAt?: string | null; createdAt?: string | null };
}) {
  if (!isNewListing(job)) return null;
  return (
    <span className="inline-flex items-center rounded-md bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
      New
    </span>
  );
}
