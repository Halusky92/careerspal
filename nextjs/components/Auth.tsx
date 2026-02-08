"use client";

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSupabaseAuth } from "./Providers";

interface AuthProps {
  onAuthSuccess?: (user: { email: string; role: 'candidate' | 'employer' }) => void;
}

const Auth: React.FC<AuthProps> = () => {
  const { signInWithGoogle, signInWithEmail } = useSupabaseAuth();
  const searchParams = useSearchParams();
  const initialRole = searchParams.get("role") === "employer" ? "employer" : "candidate";
  const [role, setRole] = useState<'candidate' | 'employer'>(initialRole);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    setRole(initialRole);
  }, [initialRole]);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    await signInWithGoogle({ role });
  };

  const handleEmailSignIn = async () => {
    if (!email.trim()) return;
    setIsLoading(true);
    try {
      await signInWithEmail(email.trim(), { role });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-24 animate-in fade-in slide-in-from-bottom-4">
      <div className="p-10 rounded-[3.5rem] shadow-2xl border bg-white border-slate-50 shadow-indigo-100">
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl font-black shadow-xl bg-indigo-600 text-white shadow-indigo-100">
            C
          </div>
          
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            Join CareersPal Elite
          </h1>
          
          <p className="font-medium mt-2 text-slate-500">
            Verified roles and signal-first hiring for operators.
          </p>
        </div>

        <div className="bg-slate-50 p-1.5 rounded-2xl flex gap-1 mb-8">
          <button 
            onClick={() => setRole('employer')} 
            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${role === 'employer' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
          >
            I am Hiring
          </button>
          <button 
            onClick={() => setRole('candidate')} 
            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${role === 'candidate' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
          >
            I am a Talent
          </button>
        </div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center -mt-4 mb-6">
          {role === 'employer' ? 'Use a company email for faster verification' : 'Talent profiles stay private until you apply'}
        </p>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          aria-busy={isLoading}
          className="w-full mb-6 flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white py-4 font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:shadow-md disabled:opacity-60"
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white border border-slate-200">
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.12 0 5.93 1.08 8.14 2.86l6.05-6.05C34.57 3.03 29.62 1 24 1 14.86 1 7.15 6.26 3.64 13.86l7.21 5.6C12.66 14.15 17.9 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.5 24c0-1.67-.15-3.27-.44-4.82H24v9.14h12.6c-.54 2.94-2.2 5.43-4.7 7.1l7.21 5.6C43.66 36.9 46.5 30.98 46.5 24z"/>
              <path fill="#FBBC05" d="M10.85 28.54A14.4 14.4 0 0 1 10 24c0-1.57.27-3.1.75-4.54l-7.21-5.6A23.97 23.97 0 0 0 1.5 24c0 3.86.92 7.51 2.54 10.86l6.81-6.32z"/>
              <path fill="#34A853" d="M24 46.5c5.62 0 10.35-1.86 13.8-5.05l-7.21-5.6c-2 1.35-4.55 2.15-6.59 2.15-6.08 0-11.3-4.65-13.13-10.96l-6.81 6.32C7.15 41.74 14.86 46.5 24 46.5z"/>
            </svg>
          </span>
          {isLoading ? "Connecting..." : "Continue with Google"}
        </button>

        <div className="space-y-3 mb-6">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">
            Or use email
          </div>
          <input
            type="email"
            inputMode="email"
            placeholder="name@company.com"
            className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 transition-all"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button
            type="button"
            onClick={handleEmailSignIn}
            disabled={isLoading || !email.trim()}
            className="w-full rounded-2xl bg-slate-900 text-white py-4 text-sm font-black uppercase tracking-widest hover:bg-black disabled:opacity-60"
          >
            {isLoading ? "Sending link..." : "Email me a sign-in link"}
          </button>
          <p className="text-[10px] text-slate-400 font-bold text-center">
            We will send a magic link to your email.
          </p>
        </div>

        <div className="rounded-[2rem] border border-slate-100 bg-slate-50/70 p-5 text-left">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Trusted access</p>
          <ul className="mt-3 space-y-2 text-xs font-bold text-slate-600">
            <li className="flex items-center gap-2"><span className="text-emerald-600">✓</span> Verified employers only</li>
            <li className="flex items-center gap-2"><span className="text-emerald-600">✓</span> Salary transparency enforced</li>
            <li className="flex items-center gap-2"><span className="text-emerald-600">✓</span> Response SLA across plans</li>
          </ul>
          <p className="mt-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            By continuing you agree to our <a className="text-indigo-600 hover:underline" href="/privacy">privacy policy</a> and <a className="text-indigo-600 hover:underline" href="/terms">terms</a>.
          </p>
        </div>

        <div className="mt-8 text-center pt-8 border-t border-slate-50">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-300">
            Need help? <a className="text-indigo-600 hover:underline" href="/about">Contact support</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
