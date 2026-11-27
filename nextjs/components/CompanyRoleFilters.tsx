import Link from "next/link";

type Row = { label: string; count: number };

type Props = {
  slug: string;
  query: string;
  place: string;
  category: string;
  work: string;
  total: number;
  categories: Row[];
  workModes: Row[];
  locations: Row[];
};

const hrefFor = (slug: string, next: { q?: string; place?: string; category?: string; work?: string }) => {
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.place) params.set("place", next.place);
  if (next.category) params.set("category", next.category);
  if (next.work) params.set("work", next.work);
  const query = params.toString();
  return query ? `/companies/${slug}?${query}` : `/companies/${slug}`;
};

function Option({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={[
        "flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium hover:bg-slate-50",
        active ? "bg-indigo-50 text-indigo-700" : "text-slate-900",
      ].join(" ")}
    >
      <span>{label}</span>
      <span className="text-xs text-slate-400 tabular-nums">{count}</span>
    </Link>
  );
}

export default function CompanyRoleFilters({ slug, query, place, category, work, total, categories, workModes, locations }: Props) {
  const current = { q: query, place, category, work };
  return (
    <form action={`/companies/${slug}`} method="get" className="space-y-3 border-t border-slate-100 px-4 py-4">
      <div className="text-sm font-semibold text-slate-900">Filters</div>
      <div>
        <label htmlFor="company-role-search" className="text-[11px] font-medium text-slate-700">
          Search roles
        </label>
        <input
          id="company-role-search"
          name="q"
          defaultValue={query}
          placeholder="Title"
          className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none"
        />
        {place ? <input type="hidden" name="place" value={place} /> : null}
        {category ? <input type="hidden" name="category" value={category} /> : null}
        {work ? <input type="hidden" name="work" value={work} /> : null}
      </div>

      <div>
        <div className="text-[11px] font-medium text-slate-700">Job categories</div>
        <div className="mt-1">
          <Option href={hrefFor(slug, { ...current, category: "" })} label="All categories" count={total} active={!category} />
          {categories.map((row) => (
            <Option
              key={row.label}
              href={hrefFor(slug, { ...current, category: row.label })}
              label={row.label}
              count={row.count}
              active={category === row.label}
            />
          ))}
        </div>
      </div>

      {workModes.length > 0 ? (
        <div>
          <div className="text-[11px] font-medium text-slate-700">Work type</div>
          <div className="mt-1">
            {workModes.map((row) => (
              <Option
                key={row.label}
                href={hrefFor(slug, { ...current, work: work === row.label ? "" : row.label })}
                label={row.label}
                count={row.count}
                active={work === row.label}
              />
            ))}
          </div>
        </div>
      ) : null}

      {locations.length > 0 ? (
        <div>
          <div className="text-[11px] font-medium text-slate-700">Location</div>
          <div className="mt-1">
            {locations.map((row) => (
              <Option
                key={row.label}
                href={hrefFor(slug, { ...current, place: place === row.label ? "" : row.label })}
                label={row.label}
                count={row.count}
                active={place === row.label}
              />
            ))}
          </div>
        </div>
      ) : null}

      <Link href={`/companies/${slug}`} className="block border-t border-slate-100 pt-3 text-xs font-medium text-slate-500 hover:text-slate-900">
        Reset filters
      </Link>
    </form>
  );
}
