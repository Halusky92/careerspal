import { formatPublicSubscriberLine } from "../lib/publicSubscriberCount";

export default function PublicSubscriberNote({
  count,
  className = "mt-2 text-sm text-slate-600",
}: {
  count: number | null;
  className?: string;
}) {
  const line = formatPublicSubscriberLine(count);
  if (!line) return null;
  return <p className={className}>{line}</p>;
}
