"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSupabaseAuth } from "./Providers";
import { hasPendingPosting, postingOwnerKey } from "../lib/postingSession";

const Auth: React.FC = () => {
  const { signInWithGoogle, signInWithEmail } = useSupabaseAuth();
  const searchParams = useSearchParams();
  const initialRole = searchParams.get("role") === "employer" ? "employer" : "candidate";
  const fromParam = searchParams.get("from");
  const desiredFrom = fromParam && fromParam.startsWith("/") ? fromParam : null;
  const [role, setRole] = useState<"candidate" | "employer">(initialRole);
  const [isLoading, setIsLoading] = useState(false);
  const [emailStatus, setEmailStatus] = useState<"idle" | "sent" | "error">("idle");
  const [emailMessage, setEmailMessage] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    setRole(initialRole);
  }, [initialRole]);

  useEffect(() => {
    try {
      if (desiredFrom) {
        sessionStorage.setItem("cp_auth_from", desiredFrom);
        localStorage.setItem("cp_auth_from", desiredFrom);
        return;
      }
      const hasPending = hasPendingPosting(postingOwnerKey());
      if (hasPending) {
        sessionStorage.setItem("cp_auth_from", "/checkout");
        localStorage.setItem("cp_auth_from", "/checkout");
      }
    } catch {
      // ignore
    }
  }, [desiredFrom]);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    await signInWithGoogle({ role, from: desiredFrom });
  };

  const handleEmailSignIn = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!email.trim()) return;
    setIsLoading(true);
    try {
      const result = await signInWithEmail(email.trim(), { role, from: desiredFrom });
      if (result.error) {
        setEmailStatus("error");
        setEmailMessage(result.error);
      } else {
        setEmailStatus("sent");
        setEmailMessage("Check your email for a sign-in link.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[400px] mx-auto">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-center mb-7">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white text-sm font-semibold flex items-center justify-center mx-auto mb-4">
            C
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Sign in</h1>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setRole("candidate")}
            className={`h-9 rounded-md text-sm font-medium ${role === "candidate" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
          >
            Candidate
          </button>
          <button
            type="button"
            onClick={() => setRole("employer")}
            className={`h-9 rounded-md text-sm font-medium ${role === "employer" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
          >
            Employer
          </button>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          aria-busy={isLoading}
          className="w-full h-11 flex items-center justify-center gap-2.5 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.12 0 5.93 1.08 8.14 2.86l6.05-6.05C34.57 3.03 29.62 1 24 1 14.86 1 7.15 6.26 3.64 13.86l7.21 5.6C12.66 14.15 17.9 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.5 24c0-1.67-.15-3.27-.44-4.82H24v9.14h12.6c-.54 2.94-2.2 5.43-4.7 7.1l7.21 5.6C43.66 36.9 46.5 30.98 46.5 24z" />
            <path fill="#FBBC05" d="M10.85 28.54A14.4 14.4 0 0 1 10 24c0-1.57.27-3.1.75-4.54l-7.21-5.6A23.97 23.97 0 0 0 1.5 24c0 3.86.92 7.51 2.54 10.86l6.81-6.32z" />
            <path fill="#34A853" d="M24 46.5c5.62 0 10.35-1.86 13.8-5.05l-7.21-5.6c-2 1.35-4.55 2.15-6.59 2.15-6.08 0-11.3-4.65-13.13-10.96l-6.81 6.32C7.15 41.74 14.86 46.5 24 46.5z" />
          </svg>
          {isLoading ? "Connecting…" : "Continue with Google"}
        </button>

        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-2 text-xs text-slate-500">or</span>
          </div>
        </div>

        <form onSubmit={handleEmailSignIn} className="space-y-3">
          <label className="block">
            <span className="sr-only">Email</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              placeholder="Email"
              className="cp-field w-full h-11 px-3 rounded-lg bg-white text-sm text-slate-900 outline-none placeholder:text-slate-400"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={isLoading || !email.trim()}
            className="w-full h-11 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-black disabled:opacity-60"
          >
            {isLoading ? "Sending…" : "Send sign-in link"}
          </button>
        </form>

        {emailMessage ? (
          <p
            className={`mt-3 text-center text-sm ${
              emailStatus === "error" ? "text-red-600" : "text-emerald-700"
            }`}
          >
            {emailMessage}
          </p>
        ) : null}

        <p className="mt-6 text-center text-xs text-slate-500">
          By continuing you agree to our{" "}
          <a className="text-slate-700 hover:underline" href="/privacy">
            Privacy
          </a>{" "}
          and{" "}
          <a className="text-slate-700 hover:underline" href="/terms">
            Terms
          </a>
          .
        </p>
      </div>
    </div>
  );
};

export default Auth;
