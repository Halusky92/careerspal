"use client";


import React, { useState } from 'react';
import { subscribeUser, type Subscriber } from '../services/notificationService';
import { CATEGORIES } from '../constants';

const Newsletter: React.FC = () => {
  const [email, setEmail] = useState('');
  const [preference, setPreference] = useState<Subscriber["preference"]>('All');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  // Vyfiltrujeme kategórie pre dropdown (odstránime 'All Roles' a pridáme 'All')
  const options = ['All', ...CATEGORIES.filter(c => c !== 'All Roles')];

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
    <div id="subscribe" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 scroll-mt-28">
      <div className="bg-slate-900 rounded-[3rem] p-12 md:p-20 relative overflow-hidden text-center shadow-2xl shadow-indigo-200">
        {/* Background Effects */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600 rounded-full blur-[120px] opacity-40 translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-600 rounded-full blur-[120px] opacity-30 -translate-x-1/3 translate-y-1/3 pointer-events-none"></div>

        <div className="relative z-10 max-w-2xl mx-auto space-y-8">
          <div>
            <span className="inline-block py-1 px-3 rounded-full bg-white/10 border border-white/20 text-white text-[10px] font-black uppercase tracking-widest mb-6">
              Priority Access
            </span>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight">
              Don&apos;t miss your next <br />
              <span className="text-indigo-400">Elite Opportunity.</span>
            </h2>
            <p className="text-slate-400 text-lg font-medium">
              Get curated role alerts. Select your expertise and we’ll notify you when a matching role drops.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              {["Verified employers", "Invite-only roles", "Response SLA"].map((label) => (
                <span
                  key={label}
                  className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-slate-200 border border-white/20 bg-white/5"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubscribe} className="flex flex-col gap-4 max-w-lg mx-auto">
            <div className="flex flex-col sm:flex-row gap-4">
               <div className="flex-1 bg-white/10 border border-white/10 rounded-2xl px-2 backdrop-blur-sm focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
                  <select 
                    value={preference}
                    onChange={(e) => setPreference(e.target.value as Subscriber["preference"])}
                    className="w-full h-full bg-transparent text-white font-bold text-sm outline-none px-4 py-4 appearance-none cursor-pointer"
                    style={{ backgroundImage: 'none' }}
                  >
                    <option value="All" className="bg-slate-900 text-slate-300">Notify me for: Everything</option>
                    {options.filter(o => o !== 'All').map(opt => (
                       <option key={opt} value={opt} className="bg-slate-900 text-white">Notify me for: {opt}</option>
                    ))}
                  </select>
               </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
               <input 
                  type="email" 
                  required
                  placeholder="Your work email" 
                  className="flex-1 px-6 py-4 rounded-2xl bg-white/10 border border-white/10 text-white placeholder:text-slate-500 font-bold outline-none focus:ring-2 focus:ring-indigo-500 backdrop-blur-sm transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
               />
               <button 
                  type="submit" 
                  className={`px-8 py-4 rounded-2xl font-black transition-all active:scale-95 shadow-xl whitespace-nowrap ${status === 'success' ? 'bg-emerald-500 text-white' : status === 'error' ? 'bg-red-500 text-white' : 'bg-white text-slate-900 hover:bg-indigo-50'}`}
               >
                  {status === 'success' ? 'Joined! ✓' : status === 'error' ? 'Try again' : 'Join List'}
               </button>
            </div>
            {msg && <p className="text-xs font-bold text-indigo-300">{msg}</p>}
          </form>

          <p className="text-slate-500 text-xs font-bold">
            We respect your inbox. Unsubscribe anytime. Data stored securely.
          </p>
          <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest">
            Zero spam. You control frequency.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Newsletter;
