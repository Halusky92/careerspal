"use client";


import React, { useState } from 'react';
import { subscribeUser, type Subscriber } from '../services/notificationService';
import { CATEGORIES } from '../constants';

type NewsletterProps = {
  defaultPreference?: Subscriber["preference"];
};

const Newsletter: React.FC<NewsletterProps> = ({ defaultPreference }) => {
  const [email, setEmail] = useState('');
  const [preference, setPreference] = useState<Subscriber["preference"]>(defaultPreference || 'All');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  // Vyfiltrujeme kategórie pre dropdown (odstránime 'All Roles' a pridáme 'All')
  const options = ['All', ...CATEGORIES.filter((c) => c !== 'All Roles')];

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = await subscribeUser(email, preference);
    
    if (result.success) {
      setStatus('success');
      setMsg(result.message);
      setEmail('');
      setTimeout(() => setStatus('idle'), 3000);
    } else {
      setStatus('error');
      setMsg(result.message);
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  return (
    <section id="subscribe" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 scroll-mt-28">
      <div className="rounded-[3rem] border border-slate-200/60 bg-white/85 backdrop-blur p-8 sm:p-12 shadow-[0_18px_55px_rgba(15,23,42,0.06)]">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500">Get alerts</p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Salary-first roles in your inbox.
          </h2>
          <p className="mt-3 text-slate-600 font-medium">
            Pick a category focus and we’ll email you when relevant remote roles are added.
          </p>
        </div>

        <form onSubmit={handleSubscribe} className="mt-8 max-w-2xl mx-auto space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="sr-only" htmlFor="alert-category">
                Category
              </label>
              <select
                id="alert-category"
                value={preference}
                onChange={(e) => setPreference(e.target.value as Subscriber["preference"])}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/30"
              >
                <option value="All">All categories</option>
                {options.filter((o) => o !== "All").map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2 flex flex-col sm:flex-row gap-3">
              <label className="sr-only" htmlFor="alert-email">
                Email
              </label>
              <input
                id="alert-email"
                type="email"
                required
                placeholder="Email address"
                className="flex-1 px-5 py-4 rounded-2xl bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 font-bold outline-none focus:ring-2 focus:ring-indigo-500/30"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button
                type="submit"
                className={`px-7 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-colors whitespace-nowrap ${
                  status === "success"
                    ? "bg-emerald-600 text-white"
                    : status === "error"
                      ? "bg-rose-600 text-white"
                      : "bg-indigo-600 text-white hover:bg-indigo-700"
                }`}
              >
                {status === "success" ? "Subscribed" : status === "error" ? "Try again" : "Get alerts"}
              </button>
            </div>
          </div>

          {msg && (
            <p className={`text-xs font-bold text-center ${status === "error" ? "text-rose-600" : "text-emerald-700"}`}>
              {msg}
            </p>
          )}

          <p className="text-slate-500 text-xs font-medium text-center">
            Unsubscribe anytime. No hype, just new roles.
          </p>
        </form>
      </div>
    </section>
  );
};

export default Newsletter;
