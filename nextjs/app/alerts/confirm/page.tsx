import Link from "next/link";
import { redirect } from "next/navigation";

const getParam = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

export default async function ConfirmAlertsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = (await searchParams) || {};
  const done = resolved.done === "1" || resolved.done === "true";
  const error = resolved.error === "1" || resolved.error === "true";
  const token = getParam(resolved.token);
  if (token && !done && !error) {
    redirect(`/api/alerts/confirm?token=${encodeURIComponent(token)}`);
  }

  return (
    <div className="bg-[#F8F9FD] pb-8">
      <div className="max-w-lg mx-auto px-4 sm:px-6 pt-10">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Job alerts</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">
            {error ? "Could not confirm" : done ? "Alerts are on" : "Confirm alerts"}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {error
              ? "The link is missing or expired. Subscribe again and use the new email."
              : done
                ? "You’re in. Fresh roles will land in your inbox."
                : "Open the confirm link from your email to start alerts."}
          </p>
          <div className="mt-4 flex gap-2">
            <Link href="/jobs" className="inline-flex h-9 items-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white">
              Browse jobs
            </Link>
            <Link href="/alerts" className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700">
              Alert settings
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
