
import React from 'react';
import { PlanType } from '../types';

interface PricingProps {
  onSelectPlan: (type: PlanType, price: number) => void;
}

const Pricing: React.FC<PricingProps> = ({ onSelectPlan }) => {
  return (
    <div className="relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-15%] w-[70%] h-[70%] bg-indigo-300/20 rounded-full blur-[140px]"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-violet-400/20 rounded-full blur-[140px]"></div>

      <div className="max-w-7xl mx-auto px-4 py-14 sm:py-20 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-4">Pricing plans</h2>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 mb-6 tracking-tight">
            Invest in the best talent.
          </h1>
          <p className="text-lg sm:text-xl text-slate-500 max-w-2xl mx-auto font-medium">
            CareersPal Elite connects you with high-signal Notion & Ops professionals. Pick a plan with verified reach and response SLAs.
          </p>
          
          <div className="mt-8 inline-flex items-center gap-2 bg-white/80 backdrop-blur text-slate-600 px-6 py-3 rounded-full border border-slate-200/60">
              <span className="text-[10px] font-black uppercase tracking-widest">Guarantee: Full refund if not published within 24h • No cancellation 7 days post-launch</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-10 sm:mb-12">
          {[
            { label: "Verified employers", value: "100%" },
            { label: "Median response", value: "2 days" },
            { label: "Private roles", value: "Invite-only" },
          ].map((item) => (
            <div key={item.label} className="bg-white/80 backdrop-blur border border-slate-200/60 rounded-2xl px-4 py-4 text-center shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
              <div className="text-2xl font-black text-slate-900">{item.value}</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{item.label}</div>
            </div>
          ))}
        </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
        {/* Standard Tier */}
        <div className="bg-white/90 backdrop-blur p-7 sm:p-10 rounded-[3rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all group flex flex-col">
          <h3 className="text-xl font-black text-gray-900 mb-2 uppercase tracking-tight">Standard</h3>
          <p className="text-gray-500 text-sm mb-8 font-medium">Perfect for growing teams building their Notion foundation.</p>
          <div className="text-4xl font-black text-gray-900 mb-8 tracking-tighter">$79 <span className="text-sm font-normal text-gray-400">/ 30 days</span></div>
          <div className="flex flex-wrap gap-2 mb-8">
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
              Verified board
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 border border-slate-200 px-2 py-1 rounded-full">
              24h review
            </span>
          </div>
          <ul className="space-y-4 mb-10 text-gray-600 font-bold text-sm flex-1">
            <li className="flex items-start gap-3"><span className="text-indigo-600">✓</span> Standard listing on the Elite Board</li>
            <li className="flex items-start gap-3"><span className="text-indigo-600">✓</span> AI Matching with relevant candidates</li>
            <li className="flex items-start gap-3"><span className="text-indigo-600">✓</span> Verified &quot;Founder Direct&quot; badge</li>
            <li className="flex items-start gap-3 text-gray-300 font-medium">✕ Slack Community Announcement</li>
            <li className="flex items-start gap-3 text-gray-300 font-medium">✕ Newsletter Promotion</li>
          </ul>
          <button onClick={() => onSelectPlan('Standard', 79)} className="w-full py-4 border-2 border-slate-100 rounded-2xl font-black text-gray-900 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all active:scale-95">
            Select Standard
          </button>
        </div>

        {/* Featured Tier */}
        <div className="bg-indigo-600 p-7 sm:p-10 rounded-[3rem] shadow-2xl shadow-indigo-200 text-white relative transform md:-translate-y-4 flex flex-col">
          <div className="absolute top-5 right-5 sm:top-6 sm:right-8 bg-indigo-500 text-[9px] sm:text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-indigo-400">Recommended</div>
          <h3 className="text-xl font-black mb-2 uppercase tracking-tight">Featured Pro</h3>
          <p className="text-indigo-100 text-sm mb-8 font-medium">Maximum visibility for critical Operations roles.</p>
          <div className="text-4xl font-black mb-8 tracking-tighter">$149 <span className="text-sm font-normal text-indigo-300">/ 30 days</span></div>
          <div className="flex flex-wrap gap-2 mb-8">
            <span className="text-[9px] font-black uppercase tracking-widest text-white bg-white/10 border border-white/20 px-2 py-1 rounded-full">
              Response SLA 2d
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest text-white bg-white/10 border border-white/20 px-2 py-1 rounded-full">
              Featured placement
            </span>
          </div>
          <ul className="space-y-4 mb-10 text-indigo-50 font-bold text-sm flex-1">
            <li className="flex items-start gap-3"><span className="text-white">🚀</span> Highlighted at top of board for 1 week</li>
            <li className="flex items-start gap-3"><span className="text-white">🚀</span> Featured in &quot;Weekly Ops&quot; Newsletter</li>
            <li className="flex items-start gap-3"><span className="text-white">🚀</span> Multi-platform Social Media Blast</li>
            <li className="flex items-start gap-3"><span className="text-white">🚀</span> AI Match Score for all applicants</li>
            <li className="flex items-start gap-3"><span className="text-white">🚀</span> Verified Stack Badge</li>
          </ul>
          <button onClick={() => onSelectPlan('Featured Pro', 149)} className="w-full py-4 bg-white text-indigo-600 rounded-2xl font-black shadow-xl hover:bg-indigo-50 transition-all active:scale-95">Select Pro</button>
        </div>

        {/* Elite Tier */}
        <div className="bg-slate-900 p-7 sm:p-10 rounded-[3rem] shadow-sm hover:shadow-2xl transition-all group flex flex-col text-white">
          <h3 className="text-xl font-black mb-2 uppercase tracking-tight">Elite Managed</h3>
          <p className="text-slate-400 text-sm mb-8 font-medium">Hand-picked talent and white-glove support.</p>
          <div className="text-4xl font-black mb-8 tracking-tighter">$249 <span className="text-sm font-normal text-slate-500">/ 30 days</span></div>
          <div className="flex flex-wrap gap-2 mb-8">
            <span className="text-[9px] font-black uppercase tracking-widest text-indigo-100 bg-indigo-500/20 border border-indigo-400/40 px-2 py-1 rounded-full">
              White‑glove
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest text-indigo-100 bg-indigo-500/20 border border-indigo-400/40 px-2 py-1 rounded-full">
              Priority support
            </span>
          </div>
          <ul className="space-y-4 mb-10 text-slate-300 font-bold text-sm flex-1">
            <li className="flex items-start gap-3"><span className="text-indigo-400">💎</span> Permanent Top-of-Board placement</li>
            <li className="flex items-start gap-3"><span className="text-indigo-400">💎</span> Dedicated Slack Announcement</li>
            <li className="flex items-start gap-3"><span className="text-indigo-400">💎</span> 3 Hand-curated candidate intros</li>
            <li className="flex items-start gap-3"><span className="text-indigo-400">💎</span> Manual Portfolio Review assistance</li>
            <li className="flex items-start gap-3"><span className="text-indigo-400">💎</span> Unlimited AI description edits</li>
          </ul>
          <button onClick={() => onSelectPlan('Elite Managed', 249)} className="w-full py-4 border-2 border-slate-700 rounded-2xl font-black text-white hover:bg-white hover:text-slate-900 hover:border-white transition-all active:scale-95">Select Elite</button>
        </div>
      </div>

      <div className="mt-10 sm:mt-12 bg-white/80 backdrop-blur border border-slate-200/60 rounded-[2.5rem] p-6 sm:p-8">
        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Plan comparison</h4>
        <div className="mt-6 overflow-x-auto">
          <div className="min-w-[520px] grid grid-cols-4 gap-x-6 gap-y-4 text-xs sm:text-sm font-bold text-slate-600">
            <div className="text-slate-400 text-xs uppercase tracking-widest">Feature</div>
            <div className="text-center">Standard</div>
            <div className="text-center">Featured</div>
            <div className="text-center">Elite</div>
            {[
              ["Listing review", "✓", "✓", "✓"],
              ["Newsletter feature", "—", "✓", "✓"],
              ["Dedicated intros", "—", "—", "✓"],
              ["Response SLA", "—", "2 days", "2 days"],
            ].map((row) => (
              <div key={row[0]} className="contents">
                <div className="text-slate-500">{row[0]}</div>
                <div className="text-center">{row[1]}</div>
                <div className="text-center">{row[2]}</div>
                <div className="text-center">{row[3]}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 sm:mt-10 bg-slate-900 text-white rounded-[2.5rem] p-8 sm:p-10">
        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-200">Why not agencies</h4>
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Avg. agency fee", value: "$8k+" },
            { label: "Median hire time", value: "45 days" },
            { label: "CareersPal", value: "2 days SLA" },
          ].map((item) => (
            <div key={item.label} className="bg-white/10 border border-white/10 rounded-2xl p-4 text-center">
              <div className="text-2xl font-black">{item.value}</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-indigo-100 mt-1">{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-12 sm:mt-20 text-center">
        <p className="text-slate-400 font-black text-xs uppercase tracking-[0.2em] mb-4">Built for teams using</p>
        <div className="flex flex-wrap justify-center items-center gap-6 sm:gap-12 opacity-40 grayscale hover:grayscale-0 transition-all duration-700">
           <img src="https://upload.wikimedia.org/wikipedia/commons/e/e9/Notion-logo.svg" className="h-5 sm:h-6" alt="Notion" />
           <img src="https://cdn.worldvectorlogo.com/logos/zapier.svg" className="h-5 sm:h-6" alt="Zapier" />
           <img src="https://upload.wikimedia.org/wikipedia/commons/4/4b/Airtable_Logo.svg" className="h-5 sm:h-6" alt="Airtable" />
           <img src="https://upload.wikimedia.org/wikipedia/commons/d/d5/Slack_icon_2019.svg" className="h-5 sm:h-6" alt="Slack" />
        </div>
        <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Tool-stack logos shown for ecosystem context, not endorsements.
        </p>
      </div>

      <div className="mt-10 sm:mt-16 bg-white/80 backdrop-blur border border-slate-200/60 rounded-[3rem] p-8 sm:p-12 shadow-[0_25px_70px_rgba(15,23,42,0.08)]">
        <div className="text-center mb-8">
          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">FAQ</p>
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mt-3">Frequently asked questions</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            {
              q: "Do you verify employers?",
              a: "Yes. Every company is vetted and must comply with salary transparency and response SLAs.",
            },
            {
              q: "Can I upgrade after posting?",
              a: "You can upgrade any listing to Featured Pro or Elite Managed at any time.",
            },
            {
              q: "What makes Elite Managed different?",
              a: "We hand-curate top candidates and provide white‑glove screening and intros.",
            },
            {
              q: "How fast do listings go live?",
              a: "Most roles are reviewed and published within 24 hours.",
            },
          ].map((item) => (
            <div key={item.q} className="bg-white border border-slate-200/60 rounded-2xl p-5">
              <p className="text-sm font-black text-slate-900">{item.q}</p>
              <p className="text-sm text-slate-500 font-medium mt-2">{item.a}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 sm:mt-10 text-center">
        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-700">
          24h review • Verified employers • SLA protected
        </span>
      </div>
      </div>
    </div>
  );
};

export default Pricing;
