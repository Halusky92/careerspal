
import React, { useEffect } from 'react';
import { Job } from '../types';

interface JobDetailProps {
  job: Job;
  allJobs: Job[];
  onBack: () => void;
  onSelectJob: (job: Job) => void;
  onSelectCompany: (companyName: string) => void;
}

const JobDetail: React.FC<JobDetailProps> = ({ job, allJobs, onBack, onSelectJob, onSelectCompany }) => {
  
  // Scroll to top when job changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [job]);

  const similarJobs = allJobs
    .filter(j => j.id !== job.id && (j.category === job.category || j.tags.some(t => job.tags.includes(t))))
    .slice(0, 3);

  const isElite = job.planType === 'Elite Managed';

  return (
    <div className="min-h-screen bg-[#F8F9FD] pb-24 animate-in fade-in duration-500">
      {/* Top Navigation Bar */}
      <div className="sticky top-20 z-40 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-slate-500 font-bold hover:text-indigo-600 transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
            Back to Board
          </button>
          <div className="hidden sm:flex items-center gap-4">
             <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">Share this role:</span>
             <div className="flex gap-2">
                <button className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                   <span className="font-black text-xs">in</span>
                </button>
                <button className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                   <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
                </button>
             </div>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="bg-white border-b border-slate-100 pt-12 pb-16">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
               <div className={`w-24 h-24 md:w-32 md:h-32 rounded-[2rem] flex items-center justify-center p-4 shadow-xl ${isElite ? 'bg-slate-900 border-2 border-slate-800' : 'bg-white border border-slate-100'}`}>
                  <img src={job.logo} alt={job.company} className="w-full h-full object-contain" />
               </div>
               <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                     {isElite && (
                        <span className="px-3 py-1 bg-amber-400 text-slate-900 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm">Elite Managed</span>
                     )}
                     <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-indigo-100">{job.type}</span>
                     <span className="px-3 py-1 bg-slate-50 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-100">{job.location}</span>
                  </div>
                  <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight mb-2">{job.title}</h1>
                  <div className="flex items-center gap-2 text-lg font-bold text-slate-500">
                     <button onClick={() => onSelectCompany(job.company)} className="text-indigo-600 hover:text-indigo-800 hover:underline transition-all">{job.company}</button>
                     <span>•</span>
                     <span>{job.salary}</span>
                  </div>
               </div>
               <div className="w-full md:w-auto">
                  <a 
                     href={job.applyUrl} 
                     target="_blank" 
                     rel="noopener noreferrer"
                     className="block w-full text-center bg-indigo-600 text-white px-10 py-5 rounded-2xl font-black text-lg shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:scale-105 transition-all"
                  >
                     Apply Now
                  </a>
                  <p className="text-center text-[10px] font-bold text-slate-400 mt-3 uppercase tracking-wider">Takes 2 minutes</p>
               </div>
            </div>
         </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
         <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            
            {/* Main Content */}
            <div className="lg:col-span-8 space-y-12">
               
               {/* Description */}
               <section className="bg-white p-8 md:p-12 rounded-[3rem] shadow-sm border border-slate-100">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-8">About the Role</h3>
                  <div className="prose prose-lg prose-indigo text-slate-600 leading-relaxed font-medium max-w-none">
                     <p className="whitespace-pre-wrap">{job.description}</p>
                  </div>
               </section>

               {/* Tech Stack */}
               <section>
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-6 px-4">Tech Stack & Tools</h3>
                  <div className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-wrap gap-4">
                     {(job.tools || job.tags).map(tool => (
                        <div key={tool} className="flex items-center gap-3 px-5 py-3 bg-slate-50 rounded-2xl border border-slate-100">
                           <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm text-lg">⚡</div>
                           <span className="font-bold text-slate-700">{tool}</span>
                        </div>
                     ))}
                  </div>
               </section>

               {/* Similar Jobs */}
               <section>
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-6 px-4">Similar Elite Roles</h3>
                  <div className="space-y-4">
                     {similarJobs.length > 0 ? similarJobs.map(simJob => (
                        <div 
                           key={simJob.id} 
                           onClick={() => onSelectJob(simJob)}
                           className="bg-white p-6 rounded-[2rem] border border-slate-100 hover:border-indigo-200 hover:shadow-lg transition-all cursor-pointer flex items-center justify-between group"
                        >
                           <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-slate-50 rounded-xl p-2 flex items-center justify-center">
                                 <img src={simJob.logo} className="max-w-full max-h-full" alt="" />
                              </div>
                              <div>
                                 <h4 className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{simJob.title}</h4>
                                 <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{simJob.company}</p>
                              </div>
                           </div>
                           <div className="text-right">
                              <span className="block font-black text-slate-900">{simJob.salary}</span>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{simJob.postedAt}</span>
                           </div>
                        </div>
                     )) : (
                        <div className="text-center py-10 bg-white rounded-[2rem] border border-dashed border-slate-200">
                           <p className="text-slate-400 font-bold">No similar roles found at the moment.</p>
                        </div>
                     )}
                  </div>
               </section>

            </div>

            {/* Sidebar */}
            <div className="lg:col-span-4 space-y-8">
               
               {/* Sticky Card */}
               <div className="sticky top-40 space-y-8">
                  <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-indigo-100/50 border border-slate-100">
                     <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-6">Job Overview</h3>
                     <ul className="space-y-6">
                        <li className="flex items-start gap-4">
                           <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 text-xl">💰</div>
                           <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Salary Range</p>
                              <p className="font-black text-slate-900 text-lg">{job.salary}</p>
                           </div>
                        </li>
                        <li className="flex items-start gap-4">
                           <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 text-xl">🌍</div>
                           <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Location</p>
                              <p className="font-black text-slate-900 text-lg">{job.location}</p>
                           </div>
                        </li>
                        <li className="flex items-start gap-4">
                           <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 text-xl">⏱️</div>
                           <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Date Posted</p>
                              <p className="font-black text-slate-900 text-lg">{job.postedAt}</p>
                           </div>
                        </li>
                     </ul>

                     <div className="mt-8 pt-8 border-t border-slate-50">
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4">Benefits & Perks</h4>
                        <div className="flex flex-wrap gap-2">
                           {(job.benefits || ['Remote First', 'Equipment Stipend', 'Flexible Hours']).map(benefit => (
                              <span key={benefit} className="px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-[10px] font-bold border border-slate-100">
                                 {benefit}
                              </span>
                           ))}
                        </div>
                     </div>
                  </div>

                  {/* Company Mini Profile */}
                  <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white">
                     <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-white rounded-xl p-1">
                           <img src={job.logo} alt="" className="w-full h-full object-contain" />
                        </div>
                        <div>
                           <h4 className="font-black text-lg">{job.company}</h4>
                           <button onClick={() => onSelectCompany(job.company)} className="text-xs text-indigo-400 font-bold hover:text-white transition-colors">View Company Profile →</button>
                        </div>
                     </div>
                     <p className="text-slate-400 text-sm font-medium leading-relaxed mb-6">
                        {job.companyDescription || "A leading company in the Notion ecosystem building the future of work."}
                     </p>
                     <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                        Verified Employer
                     </div>
                  </div>
               </div>
            </div>

         </div>
      </div>
    </div>
  );
};

export default JobDetail;
