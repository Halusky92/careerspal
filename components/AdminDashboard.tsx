
import React, { useEffect, useState } from 'react';
import { Subscriber } from '../services/notificationService';

interface AdminDashboardProps {
  onLogout: () => void;
}

// Mock Data pre Mapu - súradnice upravené pre SVG mapu
const LOCATIONS = [
  { id: 1, x: '18%', y: '38%', city: 'San Francisco', ip: '192.168.42.1', count: 420 },
  { id: 2, x: '26%', y: '35%', city: 'New York', ip: '10.0.0.14', count: 350 },
  { id: 3, x: '49%', y: '28%', city: 'London', ip: '172.16.0.55', count: 280 },
  { id: 4, x: '52%', y: '30%', city: 'Berlin', ip: '88.14.22.9', count: 210 },
  { id: 5, x: '78%', y: '55%', city: 'Singapore', ip: '202.44.11.2', count: 190 },
  { id: 6, x: '85%', y: '75%', city: 'Sydney', ip: '110.12.99.4', count: 120 },
];

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [stats, setStats] = useState({ revenue: 0, totalViews: 0 });

  // Stats Counters
  const [visits, setVisits] = useState({ total: 14502, unique: 8430, returning: 6072 });
  const [sources, setSources] = useState({ linkedin: 45, google: 30, direct: 25 });

  useEffect(() => {
    // 1. Load Data (Real connection to LocalStorage)
    const subs = JSON.parse(localStorage.getItem('cp_subscribers_db') || '[]');
    setSubscribers(subs);
    const localJobs = JSON.parse(localStorage.getItem('cp_my_jobs') || '[]');
    setJobs(localJobs);

    // Calculate revenue from real jobs
    const revenue = localJobs.reduce((acc: number, job: any) => acc + (job.plan?.price || 0), 0);
    setStats({ revenue, totalViews: localJobs.length * 145 });

    // 2. Simulation Interval (len pre jemný pohyb čísel, žiadne skákanie)
    const interval = setInterval(() => {
      setVisits(prev => ({
        ...prev,
        total: prev.total + Math.floor(Math.random() * 3),
        unique: prev.unique + (Math.random() > 0.7 ? 1 : 0)
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleDeleteJob = (id: string) => {
    if (confirm('Are you sure you want to nuke this job listing?')) {
      const updatedJobs = jobs.filter(j => j.id !== id);
      setJobs(updatedJobs);
      localStorage.setItem('cp_my_jobs', JSON.stringify(updatedJobs));
    }
  };

  const handleDeleteSubscriber = (email: string) => {
    if (confirm(`Remove ${email} from list?`)) {
      const updatedSubs = subscribers.filter(s => s.email !== email);
      setSubscribers(updatedSubs);
      localStorage.setItem('cp_subscribers_db', JSON.stringify(updatedSubs));
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-200 font-sans p-6 md:p-10 animate-in fade-in">
      {/* Top Bar */}
      <div className="max-w-[1400px] mx-auto mb-10 flex justify-between items-center border-b border-slate-800 pb-6">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-[0_0_30px_rgba(79,70,229,0.3)]">
            CP
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">Shadow Command</h1>
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
               <p className="text-xs font-mono text-emerald-500 uppercase tracking-widest">System Online • Encrypted</p>
            </div>
          </div>
        </div>
        <button onClick={onLogout} className="px-8 py-3 bg-slate-900 border border-slate-700 hover:border-red-500 hover:text-red-400 text-slate-400 rounded-xl text-xs font-black uppercase tracking-widest transition-all">
          Terminate Session
        </button>
      </div>

      <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* ROW 1: ANALYTICS CARDS (Left) */}
        <div className="lg:col-span-3 space-y-6">
           {/* Total Views Card */}
           <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 backdrop-blur-sm relative overflow-hidden group">
              <div className="relative z-10">
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Impressions</p>
                 <p className="text-4xl font-black text-white">{visits.total.toLocaleString()}</p>
                 <div className="mt-4 flex gap-2 text-[10px] font-bold">
                    <span className="text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">+12% vs last week</span>
                 </div>
              </div>
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-500/20 rounded-full blur-2xl group-hover:bg-indigo-500/30 transition-all"></div>
           </div>

           {/* Unique vs Returning */}
           <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 backdrop-blur-sm">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Audience Split</p>
              <div className="flex items-end justify-between mb-2">
                 <span className="text-indigo-400 font-bold text-xs">New</span>
                 <span className="text-white font-black">{Math.round((visits.unique / visits.total) * 100)}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full mb-4 overflow-hidden">
                 <div className="h-full bg-indigo-500" style={{ width: `${(visits.unique / visits.total) * 100}%` }}></div>
              </div>
              <div className="flex items-end justify-between mb-2">
                 <span className="text-purple-400 font-bold text-xs">Returning</span>
                 <span className="text-white font-black">{100 - Math.round((visits.unique / visits.total) * 100)}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                 <div className="h-full bg-purple-500" style={{ width: `${100 - Math.round((visits.unique / visits.total) * 100)}%` }}></div>
              </div>
           </div>

           {/* Revenue */}
           <div className="bg-gradient-to-br from-indigo-900/50 to-slate-900 p-6 rounded-3xl border border-indigo-500/30 backdrop-blur-sm relative overflow-hidden">
              <div className="relative z-10">
                 <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1">Total Revenue</p>
                 <p className="text-4xl font-black text-white">${stats.revenue.toLocaleString()}</p>
                 <p className="text-xs text-indigo-400/60 font-medium mt-1">Real-time DB Calc</p>
              </div>
           </div>
        </div>

        {/* ROW 1: GLOBAL INTELLIGENCE MAP (Center - Bigger) */}
        <div className="lg:col-span-6">
           <div className="bg-[#0F172A] rounded-[2.5rem] border border-slate-800 h-full relative overflow-hidden flex flex-col min-h-[500px]">
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/30">
                 <h3 className="text-sm font-black text-white uppercase tracking-widest">Global Live Traffic</h3>
                 <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    <span className="text-[10px] font-mono text-emerald-400">MONITORING</span>
                 </div>
              </div>
              
              <div className="flex-1 relative w-full h-full">
                 {/* World Map SVG (Simplified Path) */}
                 <svg viewBox="0 0 1000 500" className="absolute inset-0 w-full h-full pointer-events-none" style={{ filter: 'drop-shadow(0 0 10px rgba(79, 70, 229, 0.2))' }}>
                    <defs>
                      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <circle cx="1" cy="1" r="1" fill="rgba(255, 255, 255, 0.05)" />
                      </pattern>
                    </defs>
                    
                    {/* Background Grid */}
                    <rect width="100%" height="100%" fill="url(#grid)" />

                    {/* Continents Paths */}
                    <g fill="rgba(79, 70, 229, 0.15)" stroke="rgba(79, 70, 229, 0.3)" strokeWidth="1">
                       {/* North America */}
                       <path d="M 150 100 L 250 80 L 300 150 L 280 200 L 200 220 L 100 150 Z" />
                       {/* South America */}
                       <path d="M 220 230 L 300 230 L 320 300 L 280 400 L 220 350 Z" />
                       {/* Europe */}
                       <path d="M 450 100 L 520 80 L 550 130 L 480 150 L 440 130 Z" />
                       {/* Africa */}
                       <path d="M 440 160 L 550 160 L 580 250 L 520 350 L 460 300 L 420 200 Z" />
                       {/* Asia */}
                       <path d="M 560 80 L 750 80 L 850 150 L 800 250 L 650 250 L 600 150 Z" />
                       {/* Australia */}
                       <path d="M 780 300 L 880 300 L 880 380 L 780 380 Z" />
                    </g>
                 </svg>

                 {/* Locations */}
                 {LOCATIONS.map(loc => (
                    <div key={loc.id} className="absolute group" style={{ left: loc.x, top: loc.y }}>
                       <div className="relative flex items-center justify-center">
                          <div className="w-2 h-2 bg-white rounded-full relative z-10"></div>
                          <div className="absolute w-6 h-6 bg-indigo-500/60 rounded-full animate-ping"></div>
                          <div className="absolute w-12 h-12 bg-indigo-500/20 rounded-full"></div>
                          {/* Tooltip */}
                          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900 border border-indigo-500/50 px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none shadow-xl backdrop-blur-md">
                             <p className="text-[10px] font-black text-white uppercase tracking-widest">{loc.city}</p>
                             <p className="text-[9px] font-mono text-indigo-400">{loc.ip}</p>
                          </div>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        </div>

        {/* ROW 1: TRAFFIC SOURCES (Right) */}
        <div className="lg:col-span-3 space-y-6">
           {/* Sources */}
           <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800 backdrop-blur-sm h-full flex flex-col justify-center">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-8">Acquisition Channels</h3>
              
              <div className="space-y-8">
                 <div>
                    <div className="flex justify-between text-xs font-bold mb-2">
                       <span className="text-blue-400">LinkedIn</span>
                       <span className="text-slate-400">{sources.linkedin}%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full"><div className="bg-blue-500 h-full rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" style={{width: `${sources.linkedin}%`}}></div></div>
                 </div>
                 <div>
                    <div className="flex justify-between text-xs font-bold mb-2">
                       <span className="text-emerald-400">Google Search</span>
                       <span className="text-slate-400">{sources.google}%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full"><div className="bg-emerald-500 h-full rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{width: `${sources.google}%`}}></div></div>
                 </div>
                 <div>
                    <div className="flex justify-between text-xs font-bold mb-2">
                       <span className="text-amber-400">Direct / API</span>
                       <span className="text-slate-400">{sources.direct}%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full"><div className="bg-amber-500 h-full rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)]" style={{width: `${sources.direct}%`}}></div></div>
                 </div>
              </div>

              <div className="mt-12 p-4 bg-slate-950 rounded-xl border border-slate-800">
                 <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-[10px] font-black text-green-500 uppercase">Status: Optimal</span>
                 </div>
                 <p className="text-xs text-slate-500 font-mono">
                    Tracking {subscribers.length} agents across global nodes.
                 </p>
              </div>
           </div>
        </div>


        {/* ROW 2: SUBSCRIBERS */}
        <div className="lg:col-span-8">
          <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900">
              <div className="flex items-center gap-3">
                 <h3 className="text-lg font-black text-white">Encrypted Subscriber DB</h3>
                 <span className="bg-indigo-500/20 text-indigo-400 text-[10px] font-black px-2 py-1 rounded border border-indigo-500/30">
                    {subscribers.length} RECORDS
                 </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-400">
                <thead className="bg-slate-950/50 uppercase text-[10px] font-black tracking-widest text-slate-500">
                  <tr>
                    <th className="px-8 py-4">Identity</th>
                    <th className="px-8 py-4">Preference</th>
                    <th className="px-8 py-4">Timestamp</th>
                    <th className="px-8 py-4 text-right">Protocol</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {subscribers.length > 0 ? subscribers.map((sub, i) => (
                    <tr key={i} className="hover:bg-slate-800/50 transition-colors group">
                      <td className="px-8 py-4 font-bold text-slate-300 group-hover:text-white">{sub.email}</td>
                      <td className="px-8 py-4">
                        <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider ${
                          sub.preference === 'All' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {sub.preference}
                        </span>
                      </td>
                      <td className="px-8 py-4 font-mono text-xs text-slate-500">{new Date(sub.joinedAt).toLocaleDateString()}</td>
                      <td className="px-8 py-4 text-right">
                        <button onClick={() => handleDeleteSubscriber(sub.email)} className="text-slate-600 hover:text-red-500 font-bold text-xs uppercase tracking-widest transition-colors">Purge</button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={4} className="px-8 py-12 text-center text-slate-600 italic">
                         <div className="mb-2 text-2xl">🕸️</div>
                         Database is empty. Waiting for targets.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ROW 2: ACTIVE JOBS */}
        <div className="lg:col-span-4">
          <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 overflow-hidden h-full flex flex-col">
            <div className="p-8 border-b border-slate-800 bg-slate-900">
              <h3 className="text-lg font-black text-white">Active Deployments</h3>
            </div>
            <div className="p-4 space-y-3 flex-1 overflow-y-auto custom-scrollbar bg-[#0B1120]">
              {jobs.length > 0 ? jobs.map(job => (
                <div key={job.id} className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex justify-between items-center group hover:border-indigo-500/50 transition-all">
                  <div className="flex items-center gap-4">
                     <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-lg">
                        {job.planType === 'Elite Managed' ? '💎' : '💼'}
                     </div>
                     <div>
                        <h4 className="font-bold text-white text-sm line-clamp-1 group-hover:text-indigo-400 transition-colors">{job.title}</h4>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">{job.company}</p>
                     </div>
                  </div>
                  <button onClick={() => handleDeleteJob(job.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:text-red-500 hover:bg-red-950/30 transition-all">
                    ✕
                  </button>
                </div>
              )) : (
                 <div className="h-full flex flex-col items-center justify-center text-slate-600 text-sm italic">
                    <p>No active ops deployed.</p>
                 </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="lg:col-span-12 text-center pt-8 pb-4">
           <p className="text-[10px] font-mono text-slate-600 uppercase tracking-[0.2em]">
              CareersPal Internal System v2.4.0 • Level 0 Clearance Required
           </p>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
