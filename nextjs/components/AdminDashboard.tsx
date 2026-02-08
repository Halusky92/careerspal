"use client";


import React, { useEffect, useMemo, useState } from 'react';
import { Subscriber } from '../services/notificationService';
import { Job } from '../types';
import { useSupabaseAuth } from "./Providers";
import { authFetch } from "../lib/authFetch";

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

const getLocalJson = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [subscribers, setSubscribers] = useState<Subscriber[]>(() => getLocalJson<Subscriber[]>('cp_subscribers_db', []));
  const [jobs, setJobs] = useState<Job[]>(() => getLocalJson<Job[]>('cp_my_jobs', []));
  const [adminStats, setAdminStats] = useState({ users: 0, jobs: 0, savedJobs: 0, files: 0 });
  const [roleSummary, setRoleSummary] = useState<Record<string, number>>({});
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const { accessToken } = useSupabaseAuth();
  const formatDate = (value?: number) => {
    if (!value) return "N/A";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleDateString();
  };
  const getExpiryDate = (job: Job) => {
    if (!job.timestamp) return "N/A";
    const expires = new Date(job.timestamp + 30 * 24 * 60 * 60 * 1000);
    return Number.isNaN(expires.getTime()) ? "N/A" : expires.toLocaleDateString();
  };

  // Stats Counters
  const [visits, setVisits] = useState({ total: 14502, unique: 8430, returning: 6072 });
  const sources = useMemo(() => ({ linkedin: 45, google: 30, direct: 25 }), []);

  const stats = useMemo(() => {
    const revenue = jobs.reduce((acc, job) => acc + (job.plan?.price || 0), 0);
    return { revenue, totalViews: jobs.length * 145 };
  }, [jobs]);

  useEffect(() => {
    // Simulation Interval (len pre jemný pohyb čísel, žiadne skákanie)
    const interval = setInterval(() => {
      setVisits(prev => ({
        ...prev,
        total: prev.total + Math.floor(Math.random() * 3),
        unique: prev.unique + (Math.random() > 0.7 ? 1 : 0)
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadAdminStats = async () => {
      try {
        if (!accessToken) return;
        const response = await authFetch("/api/admin/stats", {}, accessToken);
        const data = (await response.json()) as { users?: number; jobs?: number; savedJobs?: number; files?: number };
        setAdminStats({
          users: data.users || 0,
          jobs: data.jobs || 0,
          savedJobs: data.savedJobs || 0,
          files: data.files || 0,
        });
        const rolesRes = await authFetch("/api/admin/role-summary", {}, accessToken);
        const rolesData = (await rolesRes.json()) as { summary?: Record<string, number> };
        setRoleSummary(rolesData.summary || {});
      } catch {
        // noop
      }
    };
    loadAdminStats();
  }, [accessToken]);

  useEffect(() => {
    const loadJobs = async () => {
      try {
        if (!accessToken) return;
        const response = await authFetch("/api/admin/jobs", {}, accessToken);
        if (!response.ok) return;
        const data = (await response.json()) as { jobs?: Job[] };
        if (data.jobs) {
          setJobs(data.jobs);
        }
      } catch {
        // fallback to local storage
      }
    };
    loadJobs();
  }, [accessToken]);

  const updateJobStatus = async (id: string, status: string) => {
    try {
      if (!accessToken) return;
      const response = await authFetch(
        `/api/admin/jobs/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
        accessToken,
      );
      if (!response.ok) return;
      const data = (await response.json()) as { job?: Job };
      if (data.job) {
        setJobs((prev) => prev.map((j) => (j.id === id ? data.job! : j)));
      }
    } catch {
      // noop
    }
  };

  const handleDeleteJob = async (id: string) => {
    if (!accessToken) return;
    if (!confirm("Delete this job permanently?")) return;
    try {
      const response = await authFetch(
        `/api/admin/jobs/${id}`,
        { method: "DELETE" },
        accessToken,
      );
      if (!response.ok) return;
      setJobs((prev) => prev.filter((job) => job.id !== id));
      setExpandedJobId((prev) => (prev === id ? null : prev));
    } catch {
      // noop
    }
  };

  const handleDeleteSubscriber = (email: string) => {
    if (confirm(`Remove ${email} from list?`)) {
      const updatedSubs = subscribers.filter(s => s.email !== email);
      setSubscribers(updatedSubs);
      localStorage.setItem('cp_subscribers_db', JSON.stringify(updatedSubs));
    }
  };

  const handleExport = async (href: string, filename: string) => {
    if (!accessToken) return;
    try {
      const response = await authFetch(href, {}, accessToken);
      if (!response.ok) return;
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch {
      // noop
    }
  };

  const pendingJobs = jobs.filter((job) => job.status === "pending_review");
  const activeJobs = jobs.filter((job) => job.status !== "pending_review");

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-200 font-sans p-4 sm:p-6 md:p-10 animate-in fade-in">
      {/* Top Bar */}
      <div className="max-w-[1400px] mx-auto mb-8 sm:mb-10 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-xl sm:text-2xl shadow-[0_0_30px_rgba(79,70,229,0.3)]">
            CP
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Shadow Command</h1>
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
               <p className="text-[10px] sm:text-xs font-mono text-emerald-500 uppercase tracking-widest">System Online • Encrypted</p>
            </div>
          </div>
        </div>
        <button onClick={onLogout} className="w-full sm:w-auto px-6 sm:px-8 py-3 bg-slate-900 border border-slate-700 hover:border-red-500 hover:text-red-400 text-slate-400 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all">
          Terminate Session
        </button>
      </div>

      <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-12 grid grid-cols-2 md:grid-cols-4 gap-4 order-1">
          {[
            { label: "Users", value: adminStats.users },
            { label: "Jobs", value: adminStats.jobs },
            { label: "Saved", value: adminStats.savedJobs },
            { label: "Files", value: adminStats.files },
          ].map((item) => (
            <div key={item.label} className="bg-[#0F172A] border border-slate-800 rounded-2xl p-4 text-center">
              <div className="text-2xl font-black text-white">{item.value}</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{item.label}</div>
            </div>
          ))}
        </div>
        <div className="lg:col-span-12 flex flex-wrap gap-2 order-2">
          {Object.entries(roleSummary).map(([role, count]) => (
            <span
              key={role}
              className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-indigo-200 border border-indigo-700/40 bg-indigo-900/30"
            >
              {role}: {count}
            </span>
          ))}
        </div>
        <div className="lg:col-span-12 flex flex-wrap gap-3 order-3">
          {[
            { label: "Users CSV", href: "/api/admin/users/export", file: "users-export.csv" },
            { label: "Jobs CSV", href: "/api/admin/jobs/export", file: "jobs-export.csv" },
            { label: "Saved CSV", href: "/api/admin/saved-jobs/export", file: "saved-jobs-export.csv" },
            { label: "Files CSV", href: "/api/admin/files/export", file: "files-export.csv" },
            { label: "Audit CSV", href: "/api/admin/audit/export", file: "audit-export.csv" },
          ].map((item) => (
            <button
              key={item.href}
              onClick={() => handleExport(item.href, item.file)}
              disabled={!accessToken}
              className={`px-4 py-2 rounded-xl border border-slate-800 text-[10px] font-black uppercase tracking-widest ${
                accessToken ? "text-slate-300 hover:border-indigo-500 hover:text-indigo-300" : "text-slate-500 opacity-60 cursor-not-allowed"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        
        {/* ROW 1: ANALYTICS CARDS (Left) */}
        <div className="lg:col-span-3 space-y-6 order-6 lg:order-none">
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
        <div className="lg:col-span-6 order-7 lg:order-none">
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
        <div className="lg:col-span-3 space-y-6 order-8 lg:order-none">
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
        <div className="lg:col-span-8 order-5 lg:order-none">
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
              <table className="w-full text-left text-xs sm:text-sm text-slate-400">
                <thead className="bg-slate-950/50 uppercase text-[9px] sm:text-[10px] font-black tracking-widest text-slate-500">
                  <tr>
                    <th className="px-4 sm:px-8 py-3 sm:py-4 whitespace-nowrap">Identity</th>
                    <th className="px-4 sm:px-8 py-3 sm:py-4 whitespace-nowrap">Preference</th>
                    <th className="px-4 sm:px-8 py-3 sm:py-4 whitespace-nowrap">Timestamp</th>
                    <th className="px-4 sm:px-8 py-3 sm:py-4 text-right whitespace-nowrap">Protocol</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {subscribers.length > 0 ? subscribers.map((sub, i) => (
                    <tr key={i} className="hover:bg-slate-800/50 transition-colors group">
                      <td className="px-4 sm:px-8 py-3 sm:py-4 font-bold text-slate-300 group-hover:text-white whitespace-nowrap">{sub.email}</td>
                      <td className="px-4 sm:px-8 py-3 sm:py-4">
                        <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider ${
                          sub.preference === 'All' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {sub.preference}
                        </span>
                      </td>
                      <td className="px-4 sm:px-8 py-3 sm:py-4 font-mono text-xs text-slate-500 whitespace-nowrap">{new Date(sub.joinedAt).toLocaleDateString()}</td>
                      <td className="px-4 sm:px-8 py-3 sm:py-4 text-right">
                        <button onClick={() => handleDeleteSubscriber(sub.email)} className="text-slate-600 hover:text-red-500 font-bold text-xs uppercase tracking-widest transition-colors">Purge</button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={4} className="px-4 sm:px-8 py-10 sm:py-12 text-center text-slate-600 italic">
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

        {/* ROW 2: PENDING REVIEW */}
        <div className="lg:col-span-4 order-4 lg:order-none">
          <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 overflow-hidden h-full flex flex-col">
            <div className="p-8 border-b border-slate-800 bg-slate-900">
              <h3 className="text-lg font-black text-white">Pending Review</h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-2">
                {pendingJobs.length} waiting
              </p>
            </div>
            <div className="p-4 space-y-3 flex-1 overflow-y-auto custom-scrollbar bg-[#0B1120]">
              {pendingJobs.length > 0 ? pendingJobs.map((job) => (
                <div key={job.id} className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-col gap-4 group hover:border-indigo-500/50 transition-all">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-lg">
                        {job.planType === 'Elite Managed' ? '💎' : '💼'}
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm line-clamp-1 group-hover:text-indigo-400 transition-colors">{job.title}</h4>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">{job.company}</p>
                      </div>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border border-amber-600/40 text-amber-300 bg-amber-600/10">
                      pending
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateJobStatus(job.id, "published")}
                      className="flex-1 bg-emerald-600/20 text-emerald-300 border border-emerald-600/40 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600/30"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => updateJobStatus(job.id, "private")}
                      className="flex-1 bg-red-600/10 text-red-400 border border-red-600/30 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest hover:bg-red-600/20"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              )) : (
                <div className="text-center py-10 text-slate-600 text-sm italic">
                  Nothing to review right now.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ROW 2: ACTIVE JOBS */}
        <div className="lg:col-span-4 order-4 lg:order-none">
          <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 overflow-hidden h-full flex flex-col">
            <div className="p-8 border-b border-slate-800 bg-slate-900">
              <h3 className="text-lg font-black text-white">Active Deployments</h3>
            </div>
            <div className="p-4 space-y-3 flex-1 overflow-y-auto custom-scrollbar bg-[#0B1120]">
              {activeJobs.length > 0 ? activeJobs.map(job => (
                <div key={job.id} className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-col gap-4 group hover:border-indigo-500/50 transition-all">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-lg">
                          {job.planType === 'Elite Managed' ? '💎' : '💼'}
                       </div>
                       <div>
                          <h4 className="font-bold text-white text-sm line-clamp-1 group-hover:text-indigo-400 transition-colors">{job.title}</h4>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider">{job.company}</p>
                       </div>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border border-slate-700 text-slate-400">
                      {job.status || "draft"}
                    </span>
                  </div>
                  {job.stripePaymentStatus === "paid" && job.status !== "published" && (
                    <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-emerald-300">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      Paid · Awaiting Accept
                    </div>
                  )}
                  <button
                    onClick={() => setExpandedJobId((prev) => (prev === job.id ? null : job.id))}
                    className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-300 text-left"
                  >
                    {expandedJobId === job.id ? "Hide details" : "View details"}
                  </button>
                  {expandedJobId === job.id && (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-xs text-slate-300 space-y-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Description</p>
                        <p className="mt-2 text-slate-300 whitespace-pre-wrap">{job.description || "No description provided."}</p>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        <p><span className="text-slate-500 font-bold">Location:</span> {job.location || "N/A"}</p>
                        <p><span className="text-slate-500 font-bold">Remote policy:</span> {job.remotePolicy || "N/A"}</p>
                        <p><span className="text-slate-500 font-bold">Type:</span> {job.type || "N/A"}</p>
                        <p><span className="text-slate-500 font-bold">Salary:</span> {job.salary || "N/A"}</p>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        <p><span className="text-slate-500 font-bold">Apply URL:</span> {job.applyUrl || "N/A"}</p>
                        <p><span className="text-slate-500 font-bold">Company website:</span> {job.companyWebsite || "N/A"}</p>
                        <p><span className="text-slate-500 font-bold">Keywords:</span> {job.keywords || "N/A"}</p>
                        <p><span className="text-slate-500 font-bold">Posted:</span> {formatDate(job.timestamp)}</p>
                        <p><span className="text-slate-500 font-bold">Expires:</span> {getExpiryDate(job)}</p>
                      </div>
                      {job.tags?.length ? (
                        <div className="flex flex-wrap gap-2">
                          {job.tags.map((tag) => (
                            <span key={tag} className="px-2 py-1 rounded-lg bg-slate-800 text-slate-200 text-[10px] font-black uppercase tracking-widest">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <button
                        onClick={() => handleDeleteJob(job.id)}
                        className="w-full bg-red-600/10 text-red-400 border border-red-600/30 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest hover:bg-red-600/20"
                      >
                        Delete job
                      </button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    {job.stripePaymentStatus === "paid" && job.status !== "published" && (
                      <button
                        onClick={() => updateJobStatus(job.id, "published")}
                        className="flex-1 bg-emerald-600/20 text-emerald-300 border border-emerald-600/40 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600/30"
                      >
                        Accept
                      </button>
                    )}
                    <button
                      onClick={() => updateJobStatus(job.id, "private")}
                      className={`${
                        job.stripePaymentStatus === "paid" && job.status !== "published" ? "flex-1" : "w-full"
                      } bg-slate-950 text-slate-500 border border-slate-800 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest hover:text-red-400 hover:border-red-600/40`}
                    >
                      Archive
                    </button>
                  </div>
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
