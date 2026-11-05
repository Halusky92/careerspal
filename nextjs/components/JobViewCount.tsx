import { formatJobViews } from "../lib/formatJobViews";

type JobViewCountProps = {
  views?: number | null;
  className?: string;
};

export default function JobViewCount({ views, className = "" }: JobViewCountProps) {
  return (
    <span className={`tabular-nums ${className}`.trim()} title="Opened by different accounts or browsers">
      {formatJobViews(views)}
    </span>
  );
}
