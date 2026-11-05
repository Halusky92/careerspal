"use client";

import { formatApplyClickRate, type DailyTraffic, type TrafficSourceRow } from "../lib/jobListingStats";
import type { PublicPerson } from "../lib/publicPerson";
import Link from "next/link";

export type ListingStatsPayload = {
  views: number;
  applyClicks: number;
  saves: number;
  applyRate: number | null;
  days: DailyTraffic[];
  sources: TrafficSourceRow[];
};

type Props = {
  loading?: boolean;
  stats: ListingStatsPayload | null;
  seekers?: { id: string; person: PublicPerson | null }[];
};

const Stat = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint: string;
}) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3">
    <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
    <div className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900">{value}</div>
    <p className="mt-1 text-xs leading-snug text-slate-500">{hint}</p>
  </div>
);

function Bars({ days }: { days: DailyTraffic[] }) {
  const max = Math.max(1, ...days.map((day) => day.views + day.applyClicks));
  if (days.every((day) => day.views === 0 && day.applyClicks === 0)) {
    return <p className="text-sm text-slate-500">No listing traffic in the last 14 days.</p>;
  }
  return (
    <div className="flex items-end gap-1 h-20">
      {days.map((day) => {
        const viewsH = Math.round((day.views / max) * 80);
        const applyH = Math.round((day.applyClicks / max) * 80);
        return (
          <div key={day.date} className="flex-1 min-w-0 flex flex-col justify-end gap-px" title={`${day.date}: ${day.views} views, ${day.applyClicks} apply clicks`}>
            <div className="w-full rounded-sm bg-indigo-200" style={{ height: Math.max(day.views ? 3 : 0, viewsH) }} />
            <div className="w-full rounded-sm bg-indigo-600" style={{ height: Math.max(day.applyClicks ? 3 : 0, applyH) }} />
          </div>
        );
      })}
    </div>
  );
}

export default function EmployerListingStats({ loading, stats, seekers = [] }: Props) {
  if (loading && !stats) {
    return <p className="text-sm text-slate-500">Loading listing traffic…</p>;
  }
  if (!stats) {
    return <p className="text-sm text-slate-500">Listing traffic is not available yet.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat
          label="Views"
          value={stats.views}
          hint="Unique accounts or browsers that opened this listing."
        />
        <Stat
          label="Apply clicks"
          value={stats.applyClicks}
          hint="Times someone opened your apply page or email from CareersPal."
        />
        <Stat
          label="Saves"
          value={stats.saves}
          hint="People who saved this listing to come back later."
        />
        <Stat
          label="Apply rate"
          value={formatApplyClickRate(stats.applyRate)}
          hint="Apply clicks divided by unique views. Not hires."
        />
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">Last 14 days</p>
        <Bars days={stats.days} />
        <p className="mt-2 text-[11px] text-slate-400">Light = views. Dark = apply clicks.</p>
      </div>

      {stats.sources.length > 0 ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">Where traffic came from</p>
          <ul className="space-y-1.5">
            {stats.sources.slice(0, 6).map((row) => (
              <li key={row.source} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-700">{row.label}</span>
                <span className="tabular-nums text-slate-500">
                  {row.views} views · {row.applyClicks} apply
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {seekers.length > 0 ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">Suggested seekers</p>
          <ul className="space-y-2">
            {seekers.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-900 truncate">{item.person?.name || "Seeker"}</span>
                {item.person?.token ? (
                  <Link href={`/p/${item.person.token}`} className="text-xs font-medium text-indigo-600">
                    Open
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-xs text-slate-400">
        These counts are listing traffic on CareersPal. We do not send candidates or track whether they finished the form on your site.
      </p>
    </div>
  );
}
