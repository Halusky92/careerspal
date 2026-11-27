"use client";

import type { ReactNode } from "react";
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

function Option({ href, label, count, active }: { href: string; label: string; count: number; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={[
        "flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm hover:bg-slate-50",
        active ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-900",
      ].join(" ")}
    >
      <span>{label}</span>
      <span className="text-xs text-slate-400 tabular-nums">{count}</span>
    </Link>
  );
}

function Group({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  return (
    <details className="group">
      <summary className="flex h-9 cursor-pointer list-none items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 truncate text-slate-900">{value || label}</span>
        <svg className="h-3.5 w-3.5 shrink-0 text-slate-400 group-open:rotate-180" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="mt-1 rounded-lg border border-slate-100 py-1">{children}</div>
    </details>
  );
}

export default function CompanyRoleFilters({ slug, query, place, category, work, total, categories, workModes, locations }: Props) {
  const current = { q: query, place, category, work };
  return (
    <form action={`/companies/${slug}`} method="get" className="space-y-2 border-t border-slate-100 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">Filters</div>
        <Link href={`/companies/${slug}`} className="text-xs font-medium text-slate-500 hover:text-slate-900">
          Reset
        </Link>
      </div>
      <input
        id="company-role-search"
        defaultValue={query}
        placeholder="Title"
        aria-label="Search roles"
        autoComplete="off"
        onKeyDown={(event) => {
          if (event.key === "Enter") event.preventDefault();
        }}
        onChange={(event) => {
          const needle = event.target.value.trim().toLowerCase();
          const rows = document.querySelectorAll<HTMLElement>("[data-company-role]");
          let shown = 0;
          rows.forEach((row) => {
            const title = (row.dataset.companyRole || "").toLowerCase();
            const match = !needle || title.includes(needle);
            row.hidden = !match;
            if (match) shown += 1;
          });
          const note = document.querySelector<HTMLElement>("[data-company-role-count]");
          if (!note) return;
          const idle = note.dataset.companyRoleNote || "";
          note.textContent = needle ? `${shown} of ${rows.length} live roles match.` : idle;
        }}
        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none"
      />
      {place ? <input type="hidden" name="place" value={place} /> : null}
      {category ? <input type="hidden" name="category" value={category} /> : null}
      {work ? <input type="hidden" name="work" value={work} /> : null}

      <Group label="Job categories" value={category}>
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
      </Group>

      {workModes.length > 0 ? (
        <Group label="Work type" value={work}>
          {workModes.map((row) => (
            <Option
              key={row.label}
              href={hrefFor(slug, { ...current, work: work === row.label ? "" : row.label })}
              label={row.label}
              count={row.count}
              active={work === row.label}
            />
          ))}
        </Group>
      ) : null}

      {locations.length > 0 ? (
        <Group label="Location" value={place}>
          {locations.map((row) => (
            <Option
              key={row.label}
              href={hrefFor(slug, { ...current, place: place === row.label ? "" : row.label })}
              label={row.label}
              count={row.count}
              active={place === row.label}
            />
          ))}
        </Group>
      ) : null}
    </form>
  );
}
