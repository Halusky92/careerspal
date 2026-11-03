"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSupabaseAuth } from "../../components/Providers";
import { authFetch } from "../../lib/authFetch";
import type { PublicPerson } from "../../lib/publicPerson";
import { hobbyChips } from "../../lib/publicPerson";
import PersonAvatar from "../../components/PersonAvatar";

export default function PeoplePage() {
  const { accessToken, profile, loading } = useSupabaseAuth();
  const [people, setPeople] = useState<PublicPerson[]>([]);
  const [ready, setReady] = useState(false);
  const canView = profile?.role === "employer" || profile?.role === "admin";

  useEffect(() => {
    const load = async () => {
      if (loading) return;
      if (!accessToken || !canView) {
        setReady(true);
        return;
      }
      const response = await authFetch("/api/people", {}, accessToken);
      const data = (await response.json()) as { people?: PublicPerson[] };
      setPeople(data.people || []);
      setReady(true);
    };
    load();
  }, [accessToken, canView, loading]);

  if (loading || !ready) {
    return <div className="py-20 text-center text-sm text-slate-500">Loading…</div>;
  }

  if (!canView) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">People</h1>
        <p className="mt-2 text-sm text-slate-600">Sign in as an employer to browse current job seekers.</p>
        <Link href="/auth?role=employer&from=/people" className="mt-5 inline-flex h-10 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium">
          Sign in as employer
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-[#F8F9FD] pb-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">People</p>
        <h1 className="mt-1 text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">Job seekers</h1>
        <p className="mt-1 text-sm text-slate-500">
          {people.length === 0
            ? "Waiting for job seekers to join this list."
            : people.length < 5
              ? "A few people are here so far. More show up as they join."
              : "Pick someone to open their profile."}
        </p>

        {people.length === 0 ? (
          <div className="mt-6 rounded-xl border border-slate-200 bg-white px-4 py-10 text-center">
            <p className="font-medium text-slate-900">Waiting for suggestions</p>
            <p className="mt-1 text-sm text-slate-500">Nobody is on the list yet. As seekers open their profiles, they appear here.</p>
          </div>
        ) : (
          <ul className="mt-5 space-y-2">
            {people.map((person) => {
              if (!person.token) return null;
              const chips = hobbyChips(person.hobbies).slice(0, 3);
              return (
                <li key={person.id}>
                  <Link
                    href={`/p/${person.token}`}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:border-indigo-200"
                  >
                    <PersonAvatar name={person.name} image={person.image} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-900 truncate">{person.name}</div>
                      <div className="mt-0.5 text-[12px] text-slate-600 truncate">
                        {person.headline || "Job seeker"}
                      </div>
                      {person.bio ? (
                        <p className="mt-1 text-[13px] text-slate-500 line-clamp-1">{person.bio}</p>
                      ) : null}
                      {chips.length > 0 ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {chips.map((chip) => (
                            <span key={chip} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600">
                              {chip}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <span className="hidden sm:inline text-xs font-medium text-indigo-600 shrink-0">View</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
