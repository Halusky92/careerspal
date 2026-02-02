
import React from 'react';
import { PlanType } from '../App';

interface PricingProps {
  onSelectPlan: (type: PlanType, price: number) => void;
}

const Pricing: React.FC<PricingProps> = ({ onSelectPlan }) => {
  return (
    <div className="max-w-7xl mx-auto px-4 py-20">
      <div className="text-center mb-16">
        <h2 className="text-sm font-black text-indigo-600 uppercase tracking-[0.3em] mb-4">Pricing Plans</h2>
        <h1 className="text-5xl font-black text-gray-900 mb-6 tracking-tighter">Invest in the best talent</h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto font-medium">CareersPal Elite connects you with high-quality Notion & Ops professionals. Choose the plan that fits your growth.</p>
        
        <div className="mt-8 inline-flex items-center gap-2 bg-slate-50 text-slate-500 px-6 py-3 rounded-full border border-slate-200">
            <span className="text-[10px] font-black uppercase tracking-widest">Guarantee: Full refund if not published within 24h • No cancellation 7 days post-launch</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Standard Tier */}
        <div className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all group flex flex-col">
          <h3 className="text-xl font-black text-gray-900 mb-2 uppercase tracking-tight">Standard</h3>
          <p className="text-gray-500 text-sm mb-8 font-medium">Perfect for growing teams building their Notion foundation.</p>
          <div className="text-4xl font-black text-gray-900 mb-8 tracking-tighter">$79 <span className="text-sm font-normal text-gray-400">/ 30 days</span></div>
          <ul className="space-y-4 mb-10 text-gray-600 font-bold text-sm flex-1">
            <li className="flex items-start gap-3"><span className="text-indigo-600">✓</span> Standard listing on the Elite Board</li>
            <li className="flex items-start gap-3"><span className="text-indigo-600">✓</span> AI Matching with relevant candidates</li>
            <li className="flex items-start gap-3"><span className="text-indigo-600">✓</span> Verified "Founder Direct" badge</li>
            <li className="flex items-start gap-3 text-gray-300 font-medium">✕ Slack Community Announcement</li>
            <li className="flex items-start gap-3 text-gray-300 font-medium">✕ Newsletter Promotion</li>
          </ul>
          <button onClick={() => onSelectPlan('Standard', 79)} className="w-full py-4 border-2 border-slate-100 rounded-2xl font-black text-gray-900 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all active:scale-95">
            Select Standard
          </button>
        </div>

        {/* Featured Tier */}
        <div className="bg-indigo-600 p-10 rounded-[3rem] shadow-2xl shadow-indigo-200 text-white relative transform md:-translate-y-4 flex flex-col">
          <div className="absolute top-6 right-8 bg-indigo-500 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-indigo-400">Recommended</div>
          <h3 className="text-xl font-black mb-2 uppercase tracking-tight">Featured Pro</h3>
          <p className="text-indigo-100 text-sm mb-8 font-medium">Maximum visibility for critical Operations roles.</p>
          <div className="text-4xl font-black mb-8 tracking-tighter">$149 <span className="text-sm font-normal text-indigo-300">/ 30 days</span></div>
          <ul className="space-y-4 mb-10 text-indigo-50 font-bold text-sm flex-1">
            <li className="flex items-start gap-3"><span className="text-white">🚀</span> Highlighted at top of board for 1 week</li>
            <li className="flex items-start gap-3"><span className="text-white">🚀</span> Featured in "Weekly Ops" Newsletter</li>
            <li className="flex items-start gap-3"><span className="text-white">🚀</span> Multi-platform Social Media Blast</li>
            <li className="flex items-start gap-3"><span className="text-white">🚀</span> AI Match Score for all applicants</li>
            <li className="flex items-start gap-3"><span className="text-white">🚀</span> Verified Stack Badge</li>
          </ul>
          <button onClick={() => onSelectPlan('Featured Pro', 149)} className="w-full py-4 bg-white text-indigo-600 rounded-2xl font-black shadow-xl hover:bg-indigo-50 transition-all active:scale-95">Select Pro</button>
        </div>

        {/* Elite Tier */}
        <div className="bg-slate-900 p-10 rounded-[3rem] shadow-sm hover:shadow-2xl transition-all group flex flex-col text-white">
          <h3 className="text-xl font-black mb-2 uppercase tracking-tight">Elite Managed</h3>
          <p className="text-slate-400 text-sm mb-8 font-medium">Hand-picked talent and white-glove support.</p>
          <div className="text-4xl font-black mb-8 tracking-tighter">$249 <span className="text-sm font-normal text-slate-500">/ 30 days</span></div>
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

      <div className="mt-20 text-center">
        <p className="text-slate-400 font-black text-xs uppercase tracking-[0.2em] mb-4">Trusted by Founders at</p>
        <div className="flex flex-wrap justify-center items-center gap-12 opacity-30 grayscale hover:grayscale-0 transition-all duration-700">
           <img src="https://upload.wikimedia.org/wikipedia/commons/e/e9/Notion-logo.svg" className="h-6" alt="Notion" />
           <img src="https://cdn.worldvectorlogo.com/logos/zapier.svg" className="h-6" alt="Zapier" />
           <img src="https://upload.wikimedia.org/wikipedia/commons/4/4b/Airtable_Logo.svg" className="h-6" alt="Airtable" />
           <img src="https://upload.wikimedia.org/wikipedia/commons/d/d5/Slack_icon_2019.svg" className="h-6" alt="Slack" />
        </div>
      </div>
    </div>
  );
};

export default Pricing;
