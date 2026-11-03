"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import CompanyLogo from "../../components/CompanyLogo";
import { CATEGORY_HUBS, getCategoryHub, type CategorySlug } from "../../lib/categories";
import {
  type BoardCompany,
  companyMatchesLocation,
  publicCompanyHost,
} from "../../lib/companyBoard";
import { locationLabelsForJobs } from "../../lib/locationFilter";

type Props = { companies: BoardCompany[] };

const CompaniesClient = ({ companies }: Props) => {
  const [query, setQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [hub, setHub] = useState<"all" | CategorySlug>("all");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"roles" | "name">("roles");
  const [open, setOpen] = useState<null | "location" | "category">(null);
  const [locationPick, setLocationPick] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const locationOptions = useMemo(
    () =>
      locationLabelsForJobs(
        companies.map((c) => ({
          location: `${c.location} ${c.locationsBlob}`,
          remotePolicy: c.remotePolicyBlob,
        })),
      ),
    [companies],
  );

  const hubOptions = useMemo(() => {
    const present = new Set(companies.flatMap((c) => c.hubs));
    return CATEGORY_HUBS.filter((item) => present.has(item.slug));
  }, [companies]);

  const hasVerified = companies.some((c) => c.verified);
  const hasRemote = companies.some((c) => c.remote);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const next = companies.filter((c) => {
      if (q && !c.name.toLowerCase().includes(q) && !publicCompanyHost(c.website).includes(q)) return false;
      if (locationQuery.trim() && !companyMatchesLocation(c, locationQuery)) return false;
      if (hub !== "all" && !c.hubs.includes(hub)) return false;
      if (remoteOnly && !c.remote) return false;
      if (verifiedOnly && !c.verified) return false;
      return true;
    });
    next.sort((a, b) => (sortBy === "name" ? a.name.localeCompare(b.name) : b.liveRoles - a.liveRoles || a.name.localeCompare(b.name)));
    return next;
  }, [companies, query, locationQuery, hub, remoteOnly, verifiedOnly, sortBy]);

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const el = target instanceof Element ? target.closest("[data-co-filter]") : null;
      if (!el) setOpen(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const clear = () => {
    setQuery("");
    setLocationQuery("");
    setHub("all");
    setRemoteOnly(false);
    setVerifiedOnly(false);
    setOpen(null);
  };

  const Filters = () => (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-semibold text-slate-900">Filter companies</div>
        <button type="button" onClick={clear} className="text-xs font-medium text-slate-500 hover:text-slate-900">
          Clear
        </button>
      </div>

      <div className="mt-4 space-y-3">
        <div className="relative" data-co-filter>
          <div className="text-[11px] font-medium text-slate-700">Hiring for</div>
          <button
            type="button"
            onClick={() => setOpen((prev) => (prev === "category" ? null : "category"))}
            className="cp-field mt-2 w-full h-10 rounded-xl bg-white px-3 text-left text-sm font-medium text-slate-900"
          >
            <span className={hub === "all" ? "text-slate-400" : ""}>
              {hub === "all" ? "Any category" : getCategoryHub(hub)?.label || hub}
            </span>
          </button>
          {open === "category" && (
            <div className="mt-2 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  setHub("all");
                  setOpen(null);
                }}
                className={`w-full text-left px-3 py-2 text-sm font-medium hover:bg-slate-50 ${hub === "all" ? "bg-indigo-50 text-indigo-700" : "text-slate-900"}`}
              >
                Any category
              </button>
              {hubOptions.map((item) => (
                <button
                  key={item.slug}
                  type="button"
                  onClick={() => {
                    setHub(item.slug);
                    setOpen(null);
                    setIsFilterOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm font-medium hover:bg-slate-50 ${hub === item.slug ? "bg-indigo-50 text-indigo-700" : "text-slate-900"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative" data-co-filter>
          <div className="text-[11px] font-medium text-slate-700">Location</div>
          <div className="relative mt-2">
            <button
              type="button"
              onClick={() => {
                setOpen((prev) => (prev === "location" ? null : "location"));
                setLocationPick("");
              }}
              className="cp-field w-full h-10 rounded-xl bg-white pl-3 pr-9 text-left text-sm font-medium text-slate-900"
            >
              <span className={locationQuery.trim() ? "" : "text-slate-400"}>{locationQuery.trim() || "Any location"}</span>
            </button>
            {locationQuery.trim() ? (
              <button
                type="button"
                aria-label="Clear location"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setLocationQuery("");
                  setOpen(null);
                }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ×
              </button>
            ) : null}
          </div>
          {open === "location" && (
            <div className="absolute z-30 mt-2 w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden">
              <div className="p-2 border-b border-slate-100">
                <input
                  value={locationPick}
                  onChange={(e) => setLocationPick(e.target.value)}
                  placeholder="City, country, or Remote"
                  className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm outline-none"
                  autoFocus
                />
              </div>
              <div className="max-h-56 overflow-y-auto py-1">
                <button
                  type="button"
                  onClick={() => {
                    setLocationQuery("");
                    setOpen(null);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-slate-500 hover:bg-slate-50"
                >
                  Any location
                </button>
                {locationOptions
                  .filter((label) => label.toLowerCase().includes(locationPick.trim().toLowerCase()))
                  .map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        setLocationQuery(label);
                        setOpen(null);
                        setIsFilterOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm font-medium hover:bg-slate-50 ${locationQuery === label ? "bg-indigo-50 text-indigo-700" : "text-slate-900"}`}
                    >
                      {label}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>

        {hasRemote && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} className="rounded border-slate-300" />
            Hiring remote
          </label>
        )}
        {hasVerified && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} className="rounded border-slate-300" />
            Verified only
          </label>
        )}
      </div>
    </div>
  );

  return (
    <div className="bg-[#F8F9FD] pb-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Companies</p>
            <h1 className="mt-1 text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">Companies with live roles</h1>
            <p className="mt-1 text-sm text-slate-600 max-w-2xl">
              {companies.length} compan{companies.length === 1 ? "y" : "ies"} with a role on the board in the last 30 days.
            </p>
          </div>
          <Link href="/jobs" className="inline-flex h-8 items-center rounded-lg bg-slate-900 px-3 text-xs font-medium text-white hover:bg-black">
            Browse jobs
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search companies…"
            className="cp-field h-10 rounded-lg px-3 text-sm"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "roles" | "name")}
            className="cp-field h-10 rounded-lg px-3 text-sm"
          >
            <option value="roles">Most roles</option>
            <option value="name">A–Z</option>
          </select>
          <button
            type="button"
            onClick={() => setIsFilterOpen(true)}
            className="lg:hidden h-10 px-4 rounded-lg bg-slate-900 text-white text-sm font-medium"
          >
            Filters
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-[16rem_minmax(0,1fr)] gap-4">
          <aside className="hidden lg:block">
            <Filters />
          </aside>

          <div>
            <p className="text-xs text-slate-500 mb-2">
              {filtered.length} shown
              {hub !== "all" ? ` · ${getCategoryHub(hub)?.label}` : ""}
              {locationQuery.trim() ? ` · ${locationQuery}` : ""}
            </p>
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center">
                <p className="font-medium text-slate-900">No companies match</p>
                <p className="mt-1 text-sm text-slate-500">Clear filters to see everyone currently hiring.</p>
                <button type="button" onClick={clear} className="mt-4 h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium">
                  Clear filters
                </button>
              </div>
            ) : (
              <ul className="space-y-2">
                {filtered.map((c) => {
                  const host = publicCompanyHost(c.website);
                  const shortDesc = c.description.length > 140 ? `${c.description.slice(0, 140).trim()}…` : c.description;
                  const hubLabels = c.hubs
                    .map((slug) => getCategoryHub(slug)?.label)
                    .filter(Boolean)
                    .slice(0, 3);
                  return (
                    <li key={c.id}>
                      <Link
                        href={`/companies/${c.slug}`}
                        className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3.5 hover:border-indigo-200"
                      >
                        <div className="w-11 h-11 rounded-lg overflow-hidden bg-white border border-slate-200 p-0.5 shrink-0">
                          <CompanyLogo
                            name={c.name}
                            logoUrl={c.logoUrl}
                            website={c.website}
                            className="w-full h-full rounded-md overflow-hidden bg-white"
                            imageClassName="w-full h-full object-contain"
                            fallbackClassName="text-[10px]"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <div className="text-sm font-semibold text-slate-900 truncate">{c.name}</div>
                            {c.verified && (
                              <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-emerald-700">
                                Verified
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-[12px] text-slate-500">
                            {c.liveRoles} live role{c.liveRoles === 1 ? "" : "s"}
                            {c.remote ? " · Remote roles" : ""}
                            {host ? ` · ${host}` : ""}
                          </div>
                          {hubLabels.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {hubLabels.map((label) => (
                                <span key={label} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                                  {label}
                                </span>
                              ))}
                            </div>
                          )}
                          {shortDesc ? <p className="mt-1.5 text-[13px] text-slate-600 leading-snug line-clamp-2">{shortDesc}</p> : null}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {isFilterOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/30" onClick={() => setIsFilterOpen(false)}>
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-[#F8F9FD] p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <div className="text-sm font-semibold">Filters</div>
              <button type="button" onClick={() => setIsFilterOpen(false)} className="text-sm text-slate-500">
                Done
              </button>
            </div>
            <Filters />
          </div>
        </div>
      )}
    </div>
  );
};

export default CompaniesClient;
