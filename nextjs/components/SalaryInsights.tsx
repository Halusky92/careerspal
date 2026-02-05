"use client";


import React, { useState } from 'react';
import { MOCK_SALARIES } from '../constants';

interface SalaryInsightsProps {
  onBrowse: () => void;
}

const SalaryInsights: React.FC<SalaryInsightsProps> = ({ onBrowse }) => {
  const [activeTab, setActiveTab] = useState<'annual' | 'hourly'>('annual');
  const [roleQuery, setRoleQuery] = useState('');

  const formatCurrency = (val: number) => {
    return activeTab === 'annual' 
      ? `$${(val / 1000).toFixed(0)}k` 
      : `$${val}`;
  };

  return (
    <div className="relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-15%] w-[70%] h-[70%] bg-indigo-300/20 rounded-full blur-[140px]"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-violet-400/20 rounded-full blur-[140px]"></div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 animate-in fade-in relative z-10">
      <div className="mb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur border border-slate-200/60 px-4 py-2 rounded-full mb-6">
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Verified data</span>
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 tracking-tight mb-6">Market <span className="text-indigo-600">Intelligence.</span></h1>
        <p className="text-base sm:text-xl text-slate-500 font-medium max-w-3xl mx-auto">
          Real-time salary benchmarks for elite Operations & Notion professionals. Stop guessing your worth.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
        {[
          { label: "Roles tracked", value: "120+" },
          { label: "Median delta", value: "+18%" },
          { label: "Data freshness", value: "Weekly" },
        ].map((item) => (
          <div key={item.label} className="bg-white/80 backdrop-blur border border-slate-200/60 rounded-2xl px-4 py-4 text-center shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
            <div className="text-2xl font-black text-slate-900">{item.value}</div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{item.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-4 mb-12">
        <div className="w-full max-w-2xl">
          <input
            value={roleQuery}
            onChange={(e) => setRoleQuery(e.target.value)}
            placeholder="Search by role (e.g. Ops Manager, Notion Architect)"
            className="w-full rounded-2xl border border-slate-200/60 bg-white/80 backdrop-blur px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300"
          />
        </div>
        <div className="bg-slate-100 p-1.5 rounded-2xl flex flex-col sm:flex-row gap-1 w-full sm:w-auto">
          <button 
            onClick={() => setActiveTab('annual')}
            className={`px-5 sm:px-8 py-2.5 sm:py-3 rounded-xl font-black text-[11px] sm:text-sm transition-all ${activeTab === 'annual' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Annual Salary (Full-time)
          </button>
          <button 
             onClick={() => setActiveTab('hourly')}
             className={`px-5 sm:px-8 py-2.5 sm:py-3 rounded-xl font-black text-[11px] sm:text-sm transition-all ${activeTab === 'hourly' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Hourly Rate (Contract)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {MOCK_SALARIES.filter((stat) =>
          stat.role.toLowerCase().includes(roleQuery.toLowerCase())
        ).map((stat, idx) => {
          const min = activeTab === 'annual' ? stat.min : stat.hourlyMin;
          const max = activeTab === 'annual' ? stat.max : stat.hourlyMax;
          const median = activeTab === 'annual' ? stat.median : (stat.hourlyMin + stat.hourlyMax) / 2;
          
          // Calculate percentage for bar visualization (relative to a fixed max for demo purposes)
          const scaleMax = activeTab === 'annual' ? 250000 : 300;
          const leftPercent = (min / scaleMax) * 100;
          const widthPercent = ((max - min) / scaleMax) * 100;

          return (
            <div key={stat.role} className="bg-white p-6 sm:p-8 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                   <h3 className="text-2xl font-black text-slate-900">{stat.role}</h3>
                   <div className="flex gap-3 mt-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.category}</span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest border ${
                        stat.demand === 'Very High' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                      }`}>
                         {stat.demand} Demand
                      </span>
                   </div>
                </div>
                <div className="text-left md:text-right w-full md:w-auto">
                   <div className="text-3xl font-black text-slate-900">{formatCurrency(median)}</div>
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Median</p>
                </div>
              </div>

              {/* Visual Bar */}
              <div className="relative h-14 sm:h-16 bg-slate-50 rounded-2xl mb-8 overflow-hidden">
                 {/* Range Bar */}
                 <div 
                    className="absolute top-4 bottom-4 bg-indigo-100 rounded-lg"
                    style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                 ></div>
                 
                 {/* Median Marker */}
                 <div 
                    className="absolute top-2 bottom-2 w-1 bg-indigo-600 rounded-full z-10"
                    style={{ left: `${(median / scaleMax) * 100}%` }}
                 ></div>
                 
                 {/* Labels */}
                <div className="absolute top-1/2 -translate-y-1/2 text-[10px] sm:text-xs font-black text-indigo-900/50" style={{ left: `${leftPercent}%`, transform: 'translateX(-120%) translateY(-50%)' }}>
                    {formatCurrency(min)}
                 </div>
                <div className="absolute top-1/2 -translate-y-1/2 text-[10px] sm:text-xs font-black text-indigo-900/50" style={{ left: `${leftPercent + widthPercent}%`, transform: 'translateX(20%) translateY(-50%)' }}>
                    {formatCurrency(max)}
                 </div>
              </div>

              <div className="flex justify-between items-center pt-6 border-t border-slate-50">
                 <div>
                    <p className="text-sm text-slate-500 font-medium">
                       Trend: <span className={`${stat.trend === 'Up' ? 'text-emerald-500' : 'text-slate-900'} font-black`}>{stat.trend === 'Up' ? '↗ Increasing' : '→ Stable'}</span>
                    </p>
                 </div>
                 <button onClick={onBrowse} className="text-indigo-600 font-black text-sm hover:underline">
                    View Open Roles →
                 </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-16 bg-slate-900 rounded-[3rem] p-8 sm:p-12 text-center text-white">
         <h2 className="text-2xl sm:text-3xl font-black mb-4">Are you earning enough?</h2>
         <p className="text-slate-400 max-w-xl mx-auto mb-8 font-medium text-sm sm:text-base">
            Join the Elite Talent Pool to get matched with companies that pay top-tier market rates. We filter out low-ball offers.
         </p>
         <button onClick={onBrowse} className="bg-white text-slate-900 px-6 sm:px-8 py-3 sm:py-4 rounded-2xl font-black hover:bg-indigo-50 transition-colors text-sm sm:text-base">
            Find High-Paying Jobs
         </button>
      </div>
      </div>
    </div>
  );
};

export default SalaryInsights;
