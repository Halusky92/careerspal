"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSupabaseAuth } from "./Providers";
import { authFetch } from "../lib/authFetch";
import type { PublicPerson } from "../lib/publicPerson";
import type { Job } from "../types";
import AdminInbox from "./AdminInbox";

type ShortItem = { id: string; jobId: string; jobTitle: string; person: PublicPerson | null };

export default function AdminPeopleTab({ jobs }: { jobs: Job[] }) {
  const { accessToken } = useSupabaseAuth();
  const [people, setPeople] = useState<PublicPerson[]>([]);
  const [items, setItems] = useState<ShortItem[]>([]);
  const [jobId, setJobId] = useState("");
  const [msg, setMsg] = useState("");

  const load = async () => {
    if (!accessToken) return;
    const [peopleRes, shortRes] = await Promise.all([
      authFetch("/api/people", {}, accessToken),
      authFetch("/api/people/shortlist", {}, accessToken),
    ]);
    const peopleData = (await peopleRes.json()) as { people?: PublicPerson[] };
    const shortData = (await shortRes.json()) as { items?: ShortItem[] };
    setPeople(peopleData.people || []);
    setItems(shortData.items || []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const attach = async (profileId: string) => {
    if (!jobId) {
      setMsg("Pick a job first.");
      return;
    }
    setMsg("");
    await authFetch(
      "/api/people/shortlist",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, profileId }),
      },
      accessToken,
    );
    await load();
  };

  const remove = async (item: ShortItem) => {
    if (!item.person) return;
    await authFetch(
      "/api/people/shortlist",
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: item.jobId, profileId: item.person.id }),
      },
      accessToken,
    );
    await load();
  };

  const liveJobs = jobs.filter((job) => job.status === "published" || job.status === "pending_review");

  return (
    <div className="space-y-6">
      <AdminInbox />
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-medium text-slate-900">Attach seekers to a listing</p>
        <p className="mt-1 text-xs text-slate-500">
          Only after you review the role. The employer then sees these people on their dashboard. Not an SLA and not a volume promise.
        </p>
        <select
          value={jobId}
          onChange={(event) => setJobId(event.target.value)}
          className="cp-field mt-3 h-10 w-full max-w-md rounded-lg px-3 text-sm"
        >
          <option value="">Select a job…</option>
          {liveJobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.title} · {job.company}
            </option>
          ))}
        </select>
        {msg ? <p className="mt-2 text-xs text-rose-600">{msg}</p> : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 text-sm font-medium text-slate-900">
          Opted-in profiles ({people.length})
        </div>
        {people.length === 0 ? (
          <p className="px-4 py-8 text-sm text-slate-500">No seekers chose employer visibility yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {people.map((person) => (
              <li key={person.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-900">{person.name}</div>
                  <div className="text-xs text-slate-500 truncate">{person.headline || "—"}</div>
                </div>
                {person.token ? (
                  <Link href={`/p/${person.token}`} className="text-xs font-medium text-indigo-600">
                    Open
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={() => attach(person.id)}
                  className="h-8 px-3 rounded-lg bg-indigo-600 text-white text-xs font-medium"
                >
                  Attach
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 text-sm font-medium text-slate-900">Attached to jobs</div>
        {items.length === 0 ? (
          <p className="px-4 py-8 text-sm text-slate-500">Nothing attached yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-900">{item.person?.name || "Seeker"}</div>
                  <div className="text-xs text-slate-500">{item.jobTitle}</div>
                </div>
                <button type="button" onClick={() => remove(item)} className="text-xs text-rose-600">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
