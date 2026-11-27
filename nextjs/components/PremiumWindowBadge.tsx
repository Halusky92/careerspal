import { isEarlyAccessListing } from "../lib/listingWindow";

export default function PremiumWindowBadge({
  job,
}: {
  job: { timestamp?: number | null; publishedAt?: string | null; createdAt?: string | null };
}) {
  if (!isEarlyAccessListing(job)) return null;
  return (
    <span className="inline-flex items-center rounded bg-[#e4c56a] px-1 py-px text-[9px] font-normal uppercase tracking-wide text-slate-950">
      Premium
    </span>
  );
}
