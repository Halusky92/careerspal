
import React, { useState, useEffect } from 'react';

interface EmployerDashboardProps {
  onUpgrade: () => void;
  onPostJob: () => void;
}

const EmployerDashboard: React.FC<EmployerDashboardProps> = ({ onUpgrade, onPostJob }) => {
  const [myJobs, setMyJobs] = useState<any[]>([]);

  useEffect(() => {
    const jobs = JSON.parse(localStorage.getItem('cp_my_jobs') || '[]');
    setMyJobs(jobs);
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
        <div>
          <h1 className="text-6xl font-black text-slate-900 tracking-tighter mb-4">Dashboard.</h1>
          <p className="text-xl text-slate-500 font-medium italic">Manage your roles and analyze candidate flow.</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl flex items-center gap-10">
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Views</p>
              <p className="text-3xl font-black text-indigo-600">0</p>
            </div>
            <div className="w-px h-12 bg-slate-100"></div>
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Applications</p>
              <p className="text-3xl font-black text-slate-900">0</p>
            </div>
          </div>
          <button 
            onClick={onPostJob}
            className="bg-indigo-600 text-white px-10 py-6 rounded-[2rem] font-black text-xl shadow-2xl shadow-indigo-100 hover:scale-105 transition-transform"
          >
            Post a Role
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between px-4">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.4em]">Your Active Listings</h3>
          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{myJobs.length} Positions</span>
        </div>
        
        {myJobs.length > 0 ? myJobs.map((job) => (
          <div key={job.id} className="bg-white p-8 rounded-[3.5rem] border border-slate-50 shadow-sm hover:shadow-2xl transition-all flex flex-col lg:flex-row items-center justify-between gap-8 group">
            <div className="flex items-center gap-8 flex-1 w-full">
              <div className="w-20 h-20 bg-slate-50 rounded-[1.8rem] flex items-center justify-center border border-slate-100 overflow-hidden flex-shrink-0">
                 <img src={job.logo || `https://picsum.photos/seed/${job.id}/100/100`} alt="" className="w-full h-full object-contain p-2" />
              </div>
              <div className="flex-1">
                <h4 className="text-2xl font-black text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors line-clamp-1">{job.title}</h4>
                <div className="flex flex-wrap items-center gap-4">
                  <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100`}>
                    {job.plan?.type || 'Standard'}
                  </span>
                  <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest italic">Applications: 0</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 w-full lg:w-auto justify-end">
               <button className="px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-black hover:bg-black transition-colors">Applicants</button>
               <button className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:text-indigo-600 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
               </button>
            </div>
          </div>
        )) : (
          <div className="bg-white py-24 rounded-[4rem] text-center border-2 border-dashed border-slate-100">
             <div className="w-24 h-24 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-8 text-4xl opacity-50">📂</div>
             <h3 className="text-3xl font-black text-slate-900 mb-4">No active roles found.</h3>
             <p className="text-slate-400 font-medium mb-12 max-w-sm mx-auto italic">Start by posting your first elite opportunity to attract the world's best Notion Ops talent.</p>
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
            <button className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black relative z-10 hover:bg-white hover:text-slate-900 transition-all shadow-xl">Contact Recruitment</button>
            <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-[100px] -mr-40 -mt-40"></div>
         </div>
         <div className="bg-indigo-50 p-12 rounded-[4rem] border border-indigo-100 flex flex-col justify-between">
            <div>
              <h3 className="text-3xl font-black text-indigo-900 mb-6 tracking-tight">Market Insights</h3>
              <p className="text-indigo-700/60 font-medium leading-relaxed italic">"The average salary for Notion-first Ops Managers has grown by 18% since January 2026."</p>
            </div>
            <div className="flex gap-4 mt-8">
               <div className="px-5 py-3 bg-white rounded-2xl text-[10px] font-black text-indigo-600 uppercase tracking-widest border border-indigo-100 shadow-sm">Global Benchmarks</div>
               <div className="px-5 py-3 bg-white rounded-2xl text-[10px] font-black text-indigo-600 uppercase tracking-widest border border-indigo-100 shadow-sm">Salary Tool</div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default EmployerDashboard;
