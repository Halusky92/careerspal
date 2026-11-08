"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { hobbyChips } from "../../../lib/publicPerson";
import PersonAvatar from "../../../components/PersonAvatar";

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
  const [person, setPerson] = useState<Person | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!token) return;
      try {
        const response = await fetch(`/api/people/${encodeURIComponent(token)}`);
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
  }, [token]);

  if (missing) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <h1 className="text-xl font-semibold text-slate-900">This profile isn’t available</h1>
        <p className="mt-2 text-sm text-slate-500">It’s private, or the link is no longer valid.</p>
        <Link href="/people" className="mt-5 inline-flex text-sm font-medium text-indigo-600">
          Back to People
        </Link>
      </div>
    );
  }

  if (!person) {
    return <div className="py-20 text-center text-sm text-slate-500">Loading…</div>;
  }

  const chips = hobbyChips(person.hobbies);
  const hasAbout = Boolean(person.bio);
  const hasHobbies = chips.length > 0;

  return (
    <div className="bg-[#F8F9FD] pb-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4">
        <Link href="/people" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-indigo-700">
          <span aria-hidden="true">←</span> All people
        </Link>

        <div className="mt-3 grid grid-cols-1 lg:grid-cols-12 gap-4">
          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-20 rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <PersonAvatar name={person.name} image={person.image} size="lg" />
                <h1 className="mt-3 text-lg font-semibold text-slate-900 tracking-tight">{person.name}</h1>
                <p className="mt-1 text-sm text-slate-600">{person.headline || "Job seeker"}</p>
                {chips.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {chips.map((chip) => (
                      <span key={chip} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                        {chip}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex flex-col gap-1.5">
                  <a
                    href="#about"
                    className="inline-flex h-9 items-center justify-center rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
                  >
                    About
                  </a>
                  <Link
                    href="/jobs"
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:border-indigo-200 hover:text-indigo-700"
                  >
                    Browse jobs
                  </Link>
                </div>
              </div>
              <div className="px-4 py-3 flex flex-wrap gap-1.5">
                {hasAbout && (
                  <a href="#about" className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-indigo-200 hover:text-indigo-700">
                    About
                  </a>
                )}
                {hasHobbies && (
                  <a href="#outside" className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-indigo-200 hover:text-indigo-700">
                    Outside work
                  </a>
                )}
              </div>
            </div>
          </aside>

          <div className="lg:col-span-8 space-y-3">
            {hasAbout ? (
              <section id="about" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">About</div>
                <h2 className="mt-1 text-base font-semibold text-slate-900">What they work on</h2>
                <p className="mt-2 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{person.bio}</p>
              </section>
            ) : (
              <section id="about" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">About</div>
                <h2 className="mt-1 text-base font-semibold text-slate-900">What they work on</h2>
                <p className="mt-2 text-sm text-slate-500">They haven’t added more about themselves yet.</p>
              </section>
            )}

            {hasHobbies ? (
              <section id="outside" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Outside work</div>
                <h2 className="mt-1 text-base font-semibold text-slate-900">Interests</h2>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {chips.map((chip) => (
                    <span key={chip} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-sm text-slate-700">
                      {chip}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            <p className="px-1 text-xs text-slate-400">Email stays private. Apply happens on the employer’s job link.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
