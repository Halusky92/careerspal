"use client";


import React, { useEffect, useState } from 'react';
import { Job } from '../types';
import { createJobSlug } from '../lib/jobs';
import CompanyLogo from './CompanyLogo';
import { useSupabaseAuth } from "./Providers";
import { authFetch } from "../lib/authFetch";

interface EmployerDashboardProps {
  onUpgrade: () => void;
  onPostJob: () => void;
}

const EmployerDashboard: React.FC<EmployerDashboardProps> = ({ onUpgrade, onPostJob }) => {
  const [myJobs, setMyJobs] = useState<Job[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const { accessToken } = useSupabaseAuth();

  useEffect(() => {
    const loadJobs = async () => {
      try {
        if (!accessToken) return;
        const response = await authFetch("/api/employer/jobs", {}, accessToken);
        if (!response.ok) return;
        const data = (await response.json()) as { jobs?: Job[]; summary?: Record<string, number> };
        if (data.jobs) {
          setMyJobs(data.jobs);
        }
        if (data.summary) {
          setSummary(data.summary);
        }
      } catch {
        // noop
      }
    };
    loadJobs();
  }, [accessToken]);

  const [stats, setStats] = useState({ jobs: 0, views: 0, matches: 0 });

  useEffect(() => {
    const loadStats = async () => {
      try {
        if (!accessToken) return;
        const response = await authFetch("/api/employer/stats", {}, accessToken);
        const data = (await response.json()) as { jobs?: number; views?: number; matches?: number };
        setStats({
          jobs: data.jobs || 0,
          views: data.views || 0,
          matches: data.matches || 0,
        });
      } catch {
        // noop
      }
    };
    loadStats();
  }, [accessToken]);

  const handleExport = async () => {
    if (!accessToken) return;
    try {
      const response = await authFetch("/api/employer/jobs/export", {}, accessToken);
      if (!response.ok) return;
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "my-jobs-export.csv";
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch {
      // noop
    }
  };

  const getStatusTone = (status?: string) => {
    switch (status) {
      case "published":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "draft":
        return "bg-slate-50 text-slate-500 border-slate-200";
      case "paused":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "private":
      case "invite_only":
        return "bg-indigo-50 text-indigo-600 border-indigo-200";
      default:
        return "bg-slate-50 text-slate-500 border-slate-200";
    }
  };

  const formatDate = (value?: number) => {
    if (!value) return "N/A";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleDateString();
  };

  const getExpiryDate = (job: Job) => {
    if (!job.timestamp) return null;
    const expires = new Date(job.timestamp + 30 * 24 * 60 * 60 * 1000);
    return Number.isNaN(expires.getTime()) ? null : expires.toLocaleDateString();
  };

  return (
    <div className="relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-15%] w-[70%] h-[70%] bg-indigo-300/20 rounded-full blur-[140px]"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-violet-400/20 rounded-full blur-[140px]"></div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 relative z-10">
      <div className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
        <div>
          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-2">Employer console</p>
          <h1 className="text-5xl sm:text-6xl font-black text-slate-900 tracking-tighter mb-4">Dashboard.</h1>
          <p className="text-xl text-slate-500 font-medium italic">Manage your roles and analyze candidate flow.</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white/80 backdrop-blur p-8 rounded-[2.5rem] border border-slate-200/60 shadow-xl flex items-center gap-10">
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Views</p>
              <p className="text-3xl font-black text-indigo-600">{stats.views}</p>
            </div>
            <div className="w-px h-12 bg-slate-100"></div>
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Applications</p>
              <p className="text-3xl font-black text-slate-900">{stats.matches}</p>
            </div>
          </div>
          <button
            onClick={onUpgrade}
            className="bg-white text-slate-900 px-8 py-6 rounded-[2rem] font-black text-xs uppercase tracking-widest border border-slate-200 shadow-sm hover:border-indigo-200 hover:text-indigo-600 transition-all"
          >
            Upgrade Plan
          </button>
          <button 
            onClick={onPostJob}
            className="bg-indigo-600 text-white px-10 py-6 rounded-[2rem] font-black text-xl shadow-2xl shadow-indigo-100 hover:scale-105 transition-transform"
          >
            Post a Role
          </button>
          <button
            onClick={handleExport}
            disabled={myJobs.length === 0 || !accessToken}
            className={`bg-white text-slate-900 px-6 py-6 rounded-[2rem] font-black text-xs uppercase tracking-widest border border-slate-200 shadow-sm transition-all ${
              myJobs.length === 0 || !accessToken
                ? "opacity-60 cursor-not-allowed"
                : "hover:border-indigo-200 hover:text-indigo-600"
            }`}
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
        {[
          { label: "Verified board", value: "Enabled" },
          { label: "Response SLA", value: "7 days" },
          { label: "Support tier", value: "Priority" },
        ].map((item) => (
          <div key={item.label} className="bg-white/80 backdrop-blur border border-slate-200/60 rounded-2xl px-4 py-4 text-center shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
            <div className="text-xl font-black text-slate-900">{item.value}</div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{item.label}</div>
          </div>
        ))}
      </div>

      <div className="mb-12 grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Published roles", value: summary.published ?? 0 },
          { label: "Draft roles", value: summary.draft ?? 0 },
          { label: "Total views", value: stats.views },
        ].map((item) => (
          <div key={item.label} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="text-2xl font-black text-slate-900">{item.value}</div>
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{item.label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between px-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.4em]">Your Active Listings</h3>
          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{summary.total ?? myJobs.length} Positions</span>
        </div>
        
        {myJobs.length > 0 ? myJobs.map((job) => {
          const isLocked = Boolean(job.status && job.status !== "published");
          return (
          <div key={job.id} className="bg-white p-8 rounded-[3.5rem] border border-slate-50 shadow-sm hover:shadow-2xl transition-all flex flex-col lg:flex-row items-center justify-between gap-8 group">
            <div className="flex items-center gap-8 flex-1 w-full">
              <div className="w-20 h-20 bg-slate-50 rounded-[1.8rem] flex items-center justify-center border border-slate-100 overflow-hidden flex-shrink-0 p-2">
                 <CompanyLogo
                   name={job.company}
                   logoUrl={job.logo}
                   website={job.companyWebsite || job.applyUrl}
                   className="w-full h-full rounded-2xl overflow-hidden bg-white"
                   imageClassName="w-full h-full object-contain"
                   fallbackClassName="text-sm"
                 />
              </div>
              <div className="flex-1">
                <h4 className="text-2xl font-black text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors line-clamp-1">{job.title}</h4>
                <div className="flex flex-wrap items-center gap-4">
                  <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100`}>
                    {job.plan?.type || 'Standard'}
                  </span>
                  <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-lg border ${getStatusTone(job.status)}`}>
                    {job.status || "draft"}
                  </span>
                  {getExpiryDate(job) && (
                    <span className="text-[9px] font-black uppercase px-3 py-1 rounded-lg bg-slate-50 text-slate-500 border border-slate-200">
                      Expires: {getExpiryDate(job)}
                    </span>
                  )}
                  <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest italic">
                    Applications: {job.matches ?? 0}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 w-full lg:w-auto justify-end">
               <a
                 href={`/jobs/${createJobSlug(job)}`}
                 onClick={(event) => {
                   if (isLocked) {
                     event.preventDefault();
                   }
                 }}
                 className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest border transition-colors ${
                   isLocked
                     ? "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed"
                     : "bg-white text-slate-600 border-slate-200 hover:border-indigo-200 hover:text-indigo-600"
                 }`}
                 aria-disabled={isLocked}
               >
                 View listing
               </a>
               <button
                 onClick={() => {
                   if (!job.matches) return;
                   alert("Applicants view is coming soon.");
                 }}
                 disabled={!job.matches}
                 className="px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-black hover:bg-black transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
               >
                 Applicants
               </button>
               <button className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:text-indigo-600 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
               </button>
            </div>
          </div>
        );
        }) : (
          <div className="bg-white py-24 rounded-[4rem] text-center border-2 border-dashed border-slate-100">
             <div className="w-24 h-24 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-8 text-4xl opacity-50">📂</div>
             <h3 className="text-3xl font-black text-slate-900 mb-4">No active roles found.</h3>
            <p className="text-slate-400 font-medium mb-12 max-w-sm mx-auto italic">Start by posting your first elite opportunity to attract the world&apos;s best Notion Ops talent.</p>
             <button 
              onClick={onPostJob}
              className="bg-indigo-600 text-white px-10 py-5 rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 hover:scale-105 transition-all"
             >
               Add First Job
             </button>
          </div>
        )}
      </div>
      
      {/* Visual Reports */}
      <div className="mt-20 grid grid-cols-1 md:grid-cols-2 gap-10">
         <div className="bg-slate-900 p-12 rounded-[4rem] text-white overflow-hidden relative group">
            <h3 className="text-3xl font-black mb-6 relative z-10 tracking-tight">Elite Managed Service</h3>
            <p className="text-slate-400 mb-10 relative z-10 font-medium leading-relaxed">Let our curators hand-pick your next Notion Database Architect. We handle the entire screening for you.</p>
            <a
              href="mailto:hello@careerspal.com?subject=Elite%20Managed%20Hiring"
              className="inline-flex items-center bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black relative z-10 hover:bg-white hover:text-slate-900 transition-all shadow-xl"
            >
              Contact Recruitment
            </a>
            <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-[100px] -mr-40 -mt-40"></div>
         </div>
         <div className="bg-indigo-50 p-12 rounded-[4rem] border border-indigo-100 flex flex-col justify-between">
            <div>
              <h3 className="text-3xl font-black text-indigo-900 mb-6 tracking-tight">Market Insights</h3>
           <p className="text-indigo-700/60 font-medium leading-relaxed italic">&quot;The average salary for Notion-first Ops Managers has grown by 18% since January 2026.&quot;</p>
            </div>
            <div className="flex gap-4 mt-8">
               <a
                 href="/salary-insights"
                 className="px-5 py-3 bg-white rounded-2xl text-[10px] font-black text-indigo-600 uppercase tracking-widest border border-indigo-100 shadow-sm hover:border-indigo-200"
               >
                 Global Benchmarks
               </a>
               <a
                 href="/salary-insights"
                 className="px-5 py-3 bg-white rounded-2xl text-[10px] font-black text-indigo-600 uppercase tracking-widest border border-indigo-100 shadow-sm hover:border-indigo-200"
               >
                 Salary Tool
               </a>
            </div>
         </div>
      </div>
      </div>
    </div>
  );
};

export default EmployerDashboard;
