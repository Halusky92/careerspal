"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSupabaseAuth } from "../../../components/Providers";
import { authFetch } from "../../../lib/authFetch";

type Person = {
  name: string;
  image: string;
  headline: string;
  bio: string;
  hobbies: string;
};

export default function PublicProfilePage() {
  const params = useParams<{ token: string }>();
  const token = params?.token || "";
  const { accessToken } = useSupabaseAuth();
  const [person, setPerson] = useState<Person | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!token) return;
      try {
        const response = accessToken
          ? await authFetch(`/api/people/${encodeURIComponent(token)}`, {}, accessToken)
          : await fetch(`/api/people/${encodeURIComponent(token)}`);
        if (!response.ok) {
          setMissing(true);
          return;
        }
        const data = (await response.json()) as { person?: Person };
        if (data.person) setPerson(data.person);
        else setMissing(true);
      } catch {
        setMissing(true);
      }
    };
    load();
  }, [token, accessToken]);

  if (missing) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <h1 className="text-xl font-semibold text-slate-900">This profile isn’t available</h1>
        <p className="mt-2 text-sm text-slate-500">It’s private, or the link is no longer valid.</p>
      </div>
    );
  }

  if (!person) {
    return <div className="py-20 text-center text-sm text-slate-500">Loading…</div>;
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
        <div className="mx-auto h-20 w-20 rounded-full overflow-hidden bg-indigo-50 text-indigo-700 flex items-center justify-center text-xl font-semibold">
          {person.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={person.image} alt="" className="h-full w-full object-cover" />
          ) : (
            (person.name || "C").slice(0, 2).toUpperCase()
          )}
        </div>
        <h1 className="mt-4 text-xl font-semibold text-slate-900">{person.name}</h1>
        {person.headline && <p className="mt-1 text-sm font-medium text-slate-700">{person.headline}</p>}
        {person.bio && <p className="mt-4 text-sm text-slate-600 text-left whitespace-pre-wrap">{person.bio}</p>}
        {person.hobbies && (
          <p className="mt-4 text-left text-sm text-slate-500">
            <span className="font-medium text-slate-700">Outside work · </span>
            {person.hobbies}
          </p>
        )}
        <p className="mt-6 text-xs text-slate-400">
          Apply happens on the employer’s job link. CareersPal may attach this profile to a listing after review — this page is not a ranked marketplace.
        </p>
      </div>
    </div>
  );
}
