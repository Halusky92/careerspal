"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSupabaseAuth } from "../../components/Providers";
import { authFetch } from "../../lib/authFetch";
import type { PublicPerson } from "../../lib/publicPerson";

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
        <p className="mt-2 text-sm text-slate-600">
          Signed-in employers can open seekers who chose to be visible. Apply still happens on your job link.
        </p>
        <Link href="/auth?role=employer&from=/people" className="mt-5 inline-flex h-10 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium">
          Sign in as employer
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-semibold text-slate-900">People</h1>
      <p className="mt-1 text-sm text-slate-500">
        Only seekers who chose “Employers on CareersPal”. CareersPal may later attach a few to a specific listing after review — this list is not a ranked marketplace.
      </p>
      {people.length === 0 ? (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white px-4 py-10 text-center">
          <p className="font-medium text-slate-900">No opted-in profiles yet</p>
          <p className="mt-1 text-sm text-slate-500">When seekers turn on employer visibility, they show up here.</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {people.map((person) => (
            <li key={person.id}>
              <Link
                href={person.token ? `/p/${person.token}` : "#"}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:border-indigo-200"
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center text-sm font-semibold">
                  {person.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={person.image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    person.name.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-slate-900">{person.name}</div>
                  {person.headline ? <div className="text-sm text-slate-600">{person.headline}</div> : null}
                  {person.bio ? <p className="mt-1 text-sm text-slate-500 line-clamp-2">{person.bio}</p> : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
