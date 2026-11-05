import { formatJobViews } from "../lib/formatJobViews";

type JobViewCountProps = {
  views?: number | null;
  className?: string;
  /** Public board hides this. Employer/admin dashboards pass true. */
  forOwner?: boolean;
};

export default function JobViewCount({ views, className = "", forOwner = false }: JobViewCountProps) {
  if (!forOwner) return null;
  return (
    <span className={`tabular-nums ${className}`.trim()} title="Opened by different accounts or browsers">
      {formatJobViews(views)}
    </span>
  );
}
