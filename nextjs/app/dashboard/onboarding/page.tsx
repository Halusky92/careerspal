"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseAuth } from "../../../components/Providers";
import { authFetch } from "../../../lib/authFetch";

const OnboardingPage = () => {
  const router = useRouter();
  const { accessToken, loading: authLoading } = useSupabaseAuth();
  const [name, setName] = useState("");
  const [role, setRole] = useState<"candidate" | "employer">("candidate");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (authLoading) return;
      if (!accessToken) {
        router.replace("/auth");
        return;
      }
      try {
        const response = await authFetch("/api/account", {}, accessToken);
        if (response.status === 401) {
          router.replace("/auth");
          return;
        }
        const data = (await response.json()) as { user?: { name?: string; role?: string; isOnboarded?: boolean } };
        if (data.user?.name) setName(data.user.name);
        if (data.user?.role === "employer") setRole("employer");
        if (data.user?.isOnboarded) {
          router.replace(data.user.role === "employer" ? "/dashboard/employer" : "/dashboard/candidate");
        }
      } catch {
        // noop
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [accessToken, authLoading, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      await authFetch(
        "/api/account",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, role }),
        },
        accessToken,
      );
      router.push(role === "employer" ? "/dashboard/employer" : "/dashboard/candidate");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 mb-6"
      >
        <span>← Back</span>
      </button>
      {isLoading ? (
        <div className="bg-white/80 backdrop-blur border border-slate-200/60 rounded-[3rem] p-10 text-center">
          <div className="inline-flex items-center gap-3 text-slate-500 font-bold">
            <span className="h-3 w-3 rounded-full bg-indigo-500 animate-pulse"></span>
            Loading onboarding...
          </div>
        </div>
      ) : (
      <div className="bg-white/80 backdrop-blur border border-slate-200/60 rounded-[3rem] p-8 sm:p-12 shadow-[0_25px_70px_rgba(15,23,42,0.08)]">
        <div className="text-center mb-8">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Onboarding</p>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 mt-3">Complete your profile</h1>
          <p className="text-slate-500 font-medium mt-3">
            This enables verified access, private roles, and response SLAs.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200/70 px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300"
              placeholder="Your name"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">I am</label>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole("candidate")}
                className={`rounded-2xl px-4 py-4 text-xs font-black uppercase tracking-widest ${
                  role === "candidate"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100"
                    : "bg-white text-slate-500 border border-slate-200"
                }`}
              >
                Talent
              </button>
              <button
                type="button"
                onClick={() => setRole("employer")}
                className={`rounded-2xl px-4 py-4 text-xs font-black uppercase tracking-widest ${
                  role === "employer"
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100"
                    : "bg-white text-slate-500 border border-slate-200"
                }`}
              >
                Employer
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-black transition-all disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Finish onboarding"}
          </button>
        </form>
      </div>
      )}
    </div>
  );
};

export default OnboardingPage;
