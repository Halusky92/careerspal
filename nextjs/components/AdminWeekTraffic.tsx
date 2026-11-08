import type { SiteDayTraffic } from "../lib/siteTraffic";

function weekday(date: string) {
  const day = new Date(`${date}T00:00:00.000Z`);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day.getUTCDay()] || date.slice(5);
}

export default function AdminWeekTraffic({
  days,
  loading,
}: {
  days?: SiteDayTraffic[] | null;
  loading?: boolean;
}) {
  const points = days || [];
  const visitorMax = Math.max(1, ...points.map((day) => day.visitors));
  const applyMax = Math.max(1, ...points.map((day) => day.applyClicks));
  const visitors = points.reduce((sum, day) => sum + day.visitors, 0);
  const applies = points.reduce((sum, day) => sum + day.applyClicks, 0);
  const views = points.reduce((sum, day) => sum + day.views, 0);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Last 7 days</p>
          <h2 className="mt-0.5 text-base font-semibold text-slate-900">Who came, who clicked Apply</h2>
        </div>
        <p className="text-xs text-slate-500">UTC days. Unique browsers, not accounts.</p>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-slate-50 px-3 py-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">People</div>
          <div className="mt-0.5 text-2xl font-semibold tabular-nums text-slate-900">{loading ? "—" : visitors}</div>
        </div>
        <div className="rounded-xl bg-indigo-50 px-3 py-3">
          <div className="text-[11px] uppercase tracking-wide text-indigo-400">Apply clicks</div>
          <div className="mt-0.5 text-2xl font-semibold tabular-nums text-indigo-700">{loading ? "—" : applies}</div>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-3">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">Page views</div>
          <div className="mt-0.5 text-2xl font-semibold tabular-nums text-slate-900">{loading ? "—" : views}</div>
        </div>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Loading this week…</p>
      ) : points.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No traffic yet this week.</p>
      ) : (
        <div className="mt-5 grid grid-cols-7 gap-2">
          {points.map((day) => (
            <div key={day.date} className="min-w-0">
              <div className="flex h-28 items-end justify-center gap-1 rounded-lg bg-slate-50 px-1 pb-1">
                <div
                  className="w-3 rounded-sm bg-slate-400"
                  style={{ height: `${Math.max(day.visitors ? 8 : 2, Math.round((day.visitors / visitorMax) * 100))}%` }}
                  title={`${day.visitors} people`}
                />
                <div
                  className="w-3 rounded-sm bg-indigo-600"
                  style={{ height: `${Math.max(day.applyClicks ? 8 : 2, Math.round((day.applyClicks / applyMax) * 100))}%` }}
                  title={`${day.applyClicks} apply clicks`}
                />
              </div>
              <p className="mt-1.5 text-center text-[11px] font-medium text-slate-600">{weekday(day.date)}</p>
              <p className="text-center text-[10px] tabular-nums text-slate-400">{day.visitors}</p>
              <p className="text-center text-[10px] tabular-nums text-indigo-600">{day.applyClicks} apply</p>
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-[11px] text-slate-400">Grey = unique people on the site. Indigo = Apply clicks that left CareersPal for the employer form.</p>
    </section>
  );
}
