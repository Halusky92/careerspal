"use client";


import React, { useEffect } from 'react';
import { Company, Job } from '../types';

interface CompanyProfileProps {
  company: Company;
  companyJobs: Job[];
  onBack: () => void;
  onSelectJob: (job: Job) => void;
}

const CompanyProfile: React.FC<CompanyProfileProps> = ({ company, companyJobs, onBack, onSelectJob }) => {
  
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [company]);

  return (
    <div className="min-h-screen bg-[#F8F9FD] pb-24 animate-in fade-in duration-500">
      {/* Top Nav */}
      <div className="sticky top-20 z-40 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-slate-500 font-bold hover:text-indigo-600 transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
            Back to Board
          </button>
        </div>
      </div>

      {/* Hero Banner */}
      <div className="relative h-64 md:h-80 w-full overflow-hidden">
        <div className="absolute inset-0 bg-slate-900">
          {company.images && company.images[0] ? (
             <img src={company.images[0]} alt="Office" className="w-full h-full object-cover opacity-60" />
          ) : (
             <div className="w-full h-full bg-gradient-to-r from-slate-900 to-indigo-900 opacity-90"></div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#F8F9FD] to-transparent"></div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative -mt-32 z-10">
        <div className="mb-10 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Response SLA", value: "7 days" },
            { label: "Hiring pace", value: "Verified" },
            { label: "Remote policy", value: company.remoteDNA?.asyncLevel || "Flexible" },
          ].map((item) => (
            <div key={item.label} className="bg-white/80 backdrop-blur border border-slate-200/60 rounded-2xl px-4 py-4 text-center shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
              <div className="text-xl font-black text-slate-900">{item.value}</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{item.label}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-col lg:flex-row gap-12 items-start">
          
          {/* Left Column: Brand & Info */}
          <div className="w-full lg:w-1/3 space-y-8">
            <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-50 text-center">
               <div className="w-32 h-32 bg-white rounded-[2rem] p-4 shadow-lg mx-auto -mt-20 mb-6 flex items-center justify-center">
                  <img src={company.logo} alt={company.name} className="w-full h-full object-contain" />
               </div>
               <div className="flex items-center justify-center gap-2 mb-2">
                 <h1 className="text-3xl font-black text-slate-900 tracking-tight">{company.name}</h1>
                 <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
                   Verified
                 </span>
               </div>
               <a href={company.website} target="_blank" rel="noreferrer" className="text-indigo-600 font-bold text-sm hover:underline block mb-6">{company.website.replace('https://', '')}</a>
               
               <div className="flex justify-center gap-3 mb-8">
                  {company.socialLinks.linkedin && (
                    <a href={company.socialLinks.linkedin} className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-600 hover:bg-indigo-600 hover:text-white transition-colors">
                       <span className="font-black text-sm">in</span>
                    </a>
                  )}
                  {company.socialLinks.twitter && (
                    <a href={company.socialLinks.twitter} className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-600 hover:bg-indigo-600 hover:text-white transition-colors">
                       <span className="font-black text-sm">𝕏</span>
                    </a>
                  )}
               </div>

               <div className="border-t border-slate-50 pt-8 grid grid-cols-2 gap-4 text-left">
                  <div>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Founded</p>
                     <p className="font-bold text-slate-900">{company.foundedYear}</p>
                  </div>
                  <div>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Size</p>
                     <p className="font-bold text-slate-900">{company.employeeCount}</p>
                  </div>
                  <div className="col-span-2">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Headquarters</p>
                     <p className="font-bold text-slate-900">{company.headquarters}</p>
                  </div>
               </div>
            </div>

            <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white">
               <h3 className="text-xs font-black uppercase tracking-widest text-indigo-400 mb-6">Tech Stack</h3>
               <div className="flex flex-wrap gap-2">
                  {company.techStack.map(tech => (
                     <span key={tech} className="px-3 py-1.5 bg-white/10 rounded-lg text-xs font-bold border border-white/10">
                        {tech}
                     </span>
                  ))}
               </div>
            </div>
          </div>

          {/* Right Column: Content & Jobs */}
          <div className="flex-1 w-full space-y-12 lg:pt-12">
             <section className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-6">About the Company</h3>
                <p className="text-xl font-bold text-slate-900 mb-6 leading-relaxed">
                   {company.description}
                </p>
                <div className="prose prose-indigo text-slate-600 font-medium max-w-none">
                   <p>{company.longDescription}</p>
                </div>
                
                {company.images && company.images.length > 1 && (
                   <div className="mt-8 grid grid-cols-2 gap-4">
                      {company.images.map((img, i) => (
                         <div key={i} className="rounded-2xl overflow-hidden h-40">
                            <img src={img} alt="" className="w-full h-full object-cover hover:scale-110 transition-transform duration-700" />
                         </div>
                      ))}
                   </div>
                )}
             </section>

             {/* REMOTE DNA SECTION - NEW FEATURE */}
             {company.remoteDNA && (
                <section className="bg-gradient-to-br from-indigo-50 to-slate-50 p-10 rounded-[3rem] border border-indigo-100">
                   <h3 className="text-sm font-black text-indigo-600 uppercase tracking-[0.2em] mb-8">Operational DNA</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-start gap-4">
                         <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-2xl">⏳</div>
                         <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Async Level</p>
                            <p className="text-lg font-black text-slate-900">{company.remoteDNA.asyncLevel}</p>
                            <p className="text-xs text-slate-500 font-medium mt-1">Expected availability</p>
                         </div>
                      </div>
                      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-start gap-4">
                         <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-2xl">📅</div>
                         <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Meeting Load</p>
                            <p className="text-lg font-black text-slate-900">{company.remoteDNA.meetingsPerWeek}</p>
                            <p className="text-xs text-slate-500 font-medium mt-1">Sync time per week</p>
                         </div>
                      </div>
                      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-start gap-4">
                         <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-2xl">📹</div>
                         <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Camera Policy</p>
                            <p className="text-lg font-black text-slate-900">{company.remoteDNA.cameraPolicy}</p>
                            <p className="text-xs text-slate-500 font-medium mt-1">Video expectations</p>
                         </div>
                      </div>
                      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-start gap-4">
                         <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-2xl">🏝️</div>
                         <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Retreats</p>
                            <p className="text-lg font-black text-slate-900">{company.remoteDNA.retreats}</p>
                            <p className="text-xs text-slate-500 font-medium mt-1">Team gathering frequency</p>
                         </div>
                      </div>
                   </div>
                </section>
             )}

             <section>
                <div className="flex items-center justify-between mb-8 px-4">
                   <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Open Roles</h3>
                   <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-xs font-black">{companyJobs.length} Active</span>
                </div>

                <div className="bg-indigo-600 text-white rounded-[2.5rem] p-6 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Now hiring</p>
                    <h4 className="text-2xl font-black mt-2">Explore verified roles at {company.name}</h4>
                  </div>
                  <button
                    onClick={() => companyJobs[0] && onSelectJob(companyJobs[0])}
                    className="bg-white text-indigo-600 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest"
                  >
                    View roles
                  </button>
                </div>

                <div className="space-y-4">
                   {companyJobs.length > 0 ? companyJobs.map(job => (
                      <div 
                         key={job.id}
                         onClick={() => onSelectJob(job)}
                         className="group bg-white p-6 rounded-[2rem] border border-slate-100 hover:border-indigo-200 hover:shadow-lg transition-all cursor-pointer flex items-center justify-between"
                      >
                         <div>
                            <h4 className="font-black text-lg text-slate-900 group-hover:text-indigo-600 transition-colors">{job.title}</h4>
                            <div className="flex gap-3 mt-1">
                               <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{job.location}</span>
                               <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">•</span>
                               <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{job.type}</span>
                            </div>
                         </div>
                         <div className="text-right">
                            <span className="block font-black text-slate-900">{job.salary}</span>
                            <span className="text-indigo-600 text-sm font-black group-hover:translate-x-1 transition-transform inline-block">View &rarr;</span>
                         </div>
                      </div>
                   )) : (
                      <p className="text-center text-slate-400 font-bold italic py-8">No open positions at the moment.</p>
                   )}
                </div>
             </section>
          </div>

        </div>
      </div>
    </div>
  );
};

export default CompanyProfile;
