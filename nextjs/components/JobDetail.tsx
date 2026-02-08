"use client";


import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Job } from '../types';

interface JobDetailProps {
  job: Job;
  allJobs: Job[];
  onBack: () => void;
  onSelectJob: (job: Job) => void;
  onSelectCompany: (companyName: string) => void;
}

const JobDetail: React.FC<JobDetailProps> = ({ job, allJobs, onBack, onSelectJob, onSelectCompany }) => {
  const router = useRouter();
  const [isReporting, setIsReporting] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Scroll to top when job changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [job]);

  useEffect(() => {
    const trackView = async () => {
      try {
        await fetch(`/api/jobs/${job.id}/view`, { method: "POST" });
      } catch {
        // no-op
      }
    };
    trackView();
  }, [job.id]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const similarJobs = allJobs
    .filter((j) => {
      const isPublic = !j.status || j.status === 'published';
      const sharesSignals = j.category === job.category || j.tags.some(t => job.tags.includes(t));
      return j.id !== job.id && isPublic && sharesSignals;
    })
    .slice(0, 3);

  const isElite = job.planType === 'Elite Managed';
  const isPrivate = job.status === 'private' || job.status === 'invite_only';
  const stack = job.tools && job.tools.length > 0 ? job.tools : job.tags;
  const hasApplyUrl = Boolean(job.applyUrl && job.applyUrl.trim() && job.applyUrl !== '#');
  const formatDate = (value?: number) => {
    if (!value) return job.postedAt;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? job.postedAt : date.toLocaleDateString();
  };
  const postedDate = formatDate(job.timestamp);

  const handleApply = async () => {
    if (isPrivate) {
      router.push('/auth');
      return;
    }
    if (!hasApplyUrl) {
      alert("Apply link is not available yet.");
      return;
    }
    try {
      await fetch(`/api/jobs/${job.id}/match`, { method: "POST" });
    } catch {
      // no-op
    }
    window.open(job.applyUrl, '_blank', 'noopener,noreferrer');
  };

  const handleShare = (target: "linkedin" | "twitter") => {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(job.title);
    const shareUrl =
      target === "linkedin"
        ? `https://www.linkedin.com/sharing/share-offsite/?url=${url}`
        : `https://twitter.com/intent/tweet?url=${url}&text=${text}`;
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-[#F8F9FD] pb-24 animate-in fade-in duration-500">
      {/* Top Navigation Bar */}
      <div className="sticky top-20 z-40 bg-white/85 backdrop-blur-md border-b border-slate-200/60 px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-slate-500 font-bold hover:text-indigo-600 transition-colors text-xs sm:text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
            Back to Board
          </button>
          <div className="flex items-center gap-3 sm:gap-4">
             <button
               onClick={onBack}
               className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-colors sm:hidden"
               aria-label="Close job detail"
             >
               <span>Close</span>
               <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
               </svg>
             </button>
             <button
               onClick={onBack}
               className="hidden sm:inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
               aria-label="Close job detail"
             >
               <span>Close</span>
               <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
               </svg>
             </button>
             <button
               onClick={async () => {
                 if (isReporting) return;
                 setIsReporting(true);
                 try {
                   const response = await fetch(`/api/jobs/${job.id}/report`, {
                     method: "POST",
                     headers: { "Content-Type": "application/json" },
                     body: JSON.stringify({ reason: "user_report" }),
                   });
                   if (!response.ok) {
                     throw new Error("Failed");
                   }
                   alert("Thanks for the report. Our team will review it.");
                 } catch {
                   alert("Unable to report this role right now.");
                 } finally {
                   setIsReporting(false);
                 }
               }}
               disabled={isReporting}
               className="hidden sm:inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
             >
               {isReporting ? "Reporting..." : "Report"}
             </button>
             <div className="hidden sm:flex items-center gap-4">
             <span className="text-slate-400 font-bold text-xs uppercase tracking-widest">Share this role:</span>
             <div className="flex gap-2">
                <button
                  onClick={() => handleShare("linkedin")}
                  className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                  aria-label="Share on LinkedIn"
                >
                   <span className="font-black text-xs">in</span>
                </button>
                <button
                  onClick={() => handleShare("twitter")}
                  className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                  aria-label="Share on X"
                >
                   <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
                </button>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(window.location.href);
                      setCopied(true);
                    } catch {
                      window.prompt("Copy this link:", window.location.href);
                    }
                  }}
                  className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                  aria-label={copied ? "Link copied" : "Copy link"}
                  title={copied ? "Copied!" : "Copy link"}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16h8a2 2 0 002-2V6a2 2 0 00-2-2H8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 16v2a2 2 0 01-2 2H6a2 2 0 01-2-2V10a2 2 0 012-2h2" />
                  </svg>
                </button>
             </div>
             </div>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="bg-white border-b border-slate-200/60 pt-12 pb-16">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
               <div className={`w-24 h-24 md:w-32 md:h-32 rounded-[2rem] flex items-center justify-center p-4 shadow-[0_20px_60px_rgba(15,23,42,0.12)] ${isElite ? 'bg-yellow-50 border-2 border-yellow-200' : 'bg-white border border-slate-200/60'}`}>
                  <img src={job.logo} alt={job.company} className="w-full h-full object-contain" />
               </div>
               <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                     {isElite && (
                        <span className="px-3 py-1 bg-yellow-200 text-yellow-900 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm">Elite Managed</span>
                     )}
                     {isPrivate && (
                       <span className="px-3 py-1 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm">Invite Only</span>
                     )}
                     <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-indigo-100">{job.type}</span>
                     <span className="px-3 py-1 bg-slate-50 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200/70">{job.location}</span>
                     <span className="px-3 py-1 bg-white text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200/70">{job.category}</span>
                     {job.remotePolicy && (
                       <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-widest border border-emerald-200">{job.remotePolicy}</span>
                     )}
                     <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-widest border border-emerald-200">Verified Employer</span>
                     {job.planType && job.planType !== 'Standard' && (
                       <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-indigo-100">Response SLA 7d</span>
                     )}
                     <span className="px-3 py-1 bg-slate-50 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200/70">
                       Posted {postedDate}
                     </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl md:text-5xl font-black text-slate-900 tracking-tight mb-2">{job.title}</h1>
                  <div className="flex items-center gap-2 text-lg font-bold text-slate-500">
                     <button onClick={() => onSelectCompany(job.company)} className="text-indigo-600 hover:text-indigo-800 hover:underline transition-all">{job.company}</button>
                     <span>•</span>
                     <span>{job.salary}</span>
                  </div>
               </div>
               <div className="w-full md:w-auto">
                  <button
                    onClick={handleApply}
                    disabled={!isPrivate && !hasApplyUrl}
                    className={`block w-full text-center px-8 sm:px-10 py-4 sm:py-5 rounded-2xl font-black text-base sm:text-lg shadow-[0_20px_60px_rgba(15,23,42,0.35)] hover:scale-[1.02] transition-all ${
                      isPrivate
                        ? 'bg-slate-900 text-white hover:bg-slate-950'
                        : hasApplyUrl
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-[0_20px_60px_rgba(79,70,229,0.35)]'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                    }`}
                  >
                    {isPrivate ? 'Request Access' : hasApplyUrl ? 'Apply Now' : 'Apply Soon'}
                  </button>
                  <p className="text-center text-[10px] font-bold text-slate-400 mt-3 uppercase tracking-wider">Takes 2 minutes</p>
               </div>
            </div>
         </div>
      </div>

      {/* Mobile quick filter table */}
      <div className="lg:hidden px-4 sm:px-6">
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-[0_16px_40px_rgba(15,23,42,0.06)] -mt-6 mb-8">
          <div className="px-5 pt-4 pb-3 border-b border-slate-100">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Quick Filters</h3>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[520px] sm:min-w-[560px] grid grid-cols-5 gap-2 sm:gap-3 px-4 sm:px-5 py-3 sm:py-4 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400">
              <span className="whitespace-nowrap">Salary Range</span>
              <span className="whitespace-nowrap">Job Type</span>
              <span className="whitespace-nowrap">Location</span>
              <span className="whitespace-nowrap">Category</span>
              <span className="whitespace-nowrap">Remote Policy</span>
            </div>
            <div className="min-w-[520px] sm:min-w-[560px] grid grid-cols-5 gap-2 sm:gap-3 px-4 sm:px-5 pb-4 sm:pb-5">
              <div className="bg-slate-50 border border-slate-200/60 rounded-xl px-3 py-2 text-[11px] sm:text-xs font-bold text-slate-700 whitespace-nowrap">{job.salary}</div>
              <div className="bg-slate-50 border border-slate-200/60 rounded-xl px-3 py-2 text-[11px] sm:text-xs font-bold text-slate-700 whitespace-nowrap">{job.type}</div>
              <div className="bg-slate-50 border border-slate-200/60 rounded-xl px-3 py-2 text-[11px] sm:text-xs font-bold text-slate-700 whitespace-nowrap">{job.location}</div>
              <div className="bg-slate-50 border border-slate-200/60 rounded-xl px-3 py-2 text-[11px] sm:text-xs font-bold text-slate-700 whitespace-nowrap">{job.category}</div>
              <div className="bg-slate-50 border border-slate-200/60 rounded-xl px-3 py-2 text-[11px] sm:text-xs font-bold text-slate-700 whitespace-nowrap">{job.remotePolicy || "Remote"}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
         <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            
            {/* Main Content */}
            <div className="lg:col-span-8 space-y-12">
               <section className="hidden lg:block bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-200/60 shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
                  <div className="grid grid-cols-4 gap-4 text-center">
                     {[
                       { label: "Salary", value: job.salary },
                       { label: "Type", value: job.type },
                       { label: "Location", value: job.location },
                       { label: "Remote", value: job.remotePolicy || "Remote" },
                     ].map((item) => (
                       <div key={item.label} className="bg-slate-50 border border-slate-200/60 rounded-2xl px-4 py-4">
                         <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{item.label}</div>
                         <div className="mt-2 text-sm font-black text-slate-900">{item.value}</div>
                       </div>
                     ))}
                  </div>
               </section>
               
               {/* Description */}
               <section className="bg-white p-6 sm:p-8 md:p-12 rounded-[2rem] sm:rounded-[3rem] shadow-[0_20px_60px_rgba(15,23,42,0.06)] border border-slate-200/60">
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-8">About the Role</h3>
                  <div className="prose prose-lg prose-indigo text-slate-600 leading-relaxed font-medium max-w-none">
                     <p className="whitespace-pre-wrap">{job.description}</p>
                  </div>
               </section>

               {/* Tech Stack */}
               <section>
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-6 px-4">Tech Stack & Tools</h3>
                  <div className="bg-white p-6 sm:p-8 md:p-10 rounded-[2rem] sm:rounded-[2.5rem] shadow-[0_16px_50px_rgba(15,23,42,0.06)] border border-slate-200/60 flex flex-wrap gap-4">
                     {stack.map(tool => (
                        <div key={tool} className="flex items-center gap-3 px-4 sm:px-5 py-2.5 sm:py-3 bg-white rounded-2xl border border-slate-200/60 shadow-sm">
                           <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center shadow-sm text-lg">⚡</div>
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
                           className="bg-white p-5 sm:p-6 rounded-[2rem] border border-slate-200/60 hover:border-indigo-200 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)] transition-all cursor-pointer flex items-center justify-between group"
                        >
                           <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-white rounded-xl p-2 flex items-center justify-center border border-slate-200/60">
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
                  <div className="bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-[0_20px_60px_rgba(15,23,42,0.08)] border border-slate-200/60">
                     <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-6">Job Overview</h3>
                     <ul className="space-y-6">
                        <li className="flex items-start gap-4">
                           <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200/60 flex items-center justify-center">
                              <img src="/icons/salary.svg" alt="" className="w-5 h-5 opacity-70" />
                           </div>
                           <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Salary Range</p>
                              <p className="font-black text-slate-900 text-lg">{job.salary}</p>
                           </div>
                        </li>
                        <li className="flex items-start gap-4">
                           <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200/60 flex items-center justify-center">
                              <img src="/icons/location.svg" alt="" className="w-5 h-5 opacity-70" />
                           </div>
                           <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Location</p>
                              <p className="font-black text-slate-900 text-lg">{job.location}</p>
                           </div>
                        </li>
                        <li className="flex items-start gap-4">
                           <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200/60 flex items-center justify-center">
                              <img src="/icons/calendar.svg" alt="" className="w-5 h-5 opacity-70" />
                           </div>
                           <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Date Posted</p>
                              <p className="font-black text-slate-900 text-lg">{postedDate}</p>
                           </div>
                        </li>
                     </ul>

                     <div className="mt-8 pt-8 border-t border-slate-50">
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4">Benefits & Perks</h4>
                        <div className="flex flex-wrap gap-2">
                           {(job.benefits || ['Remote First', 'Equipment Stipend', 'Flexible Hours']).map(benefit => (
                              <span key={benefit} className="px-3 py-1.5 bg-white text-slate-700 rounded-lg text-[10px] font-bold border border-slate-200/60">
                                 {benefit}
                              </span>
                           ))}
                        </div>
                     </div>
                     <div className="mt-6 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-slate-200/60 bg-slate-50 px-4 py-3">
                           <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Views</div>
                           <div className="text-sm font-black text-slate-900 mt-1">{job.views ?? 0}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200/60 bg-slate-50 px-4 py-3">
                           <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Matches</div>
                           <div className="text-sm font-black text-slate-900 mt-1">{job.matches ?? 0}</div>
                        </div>
                     </div>
                  </div>

                  {/* Company Mini Profile */}
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
                     <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-white rounded-xl p-1 border border-slate-200/60">
                           <img src={job.logo} alt="" className="w-full h-full object-contain" />
                        </div>
                        <div>
                           <h4 className="font-black text-lg text-slate-900">{job.company}</h4>
                           <button onClick={() => onSelectCompany(job.company)} className="text-xs text-indigo-600 font-bold hover:text-indigo-800 transition-colors">View Company Profile →</button>
                        </div>
                     </div>
                     <p className="text-slate-600 text-sm font-medium leading-relaxed mb-6">
                        {job.companyDescription || "A leading company in the Notion ecosystem building the future of work."}
                     </p>
                     <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                        Verified Employer
                     </div>
                 {job.companyWebsite && (
                   <a
                     href={job.companyWebsite}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="mt-4 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800"
                   >
                     Visit company site →
                   </a>
                 )}
                  </div>
               </div>
            </div>

         </div>
      </div>

      <div className="fixed bottom-6 right-6">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="rounded-full bg-white border border-slate-200 shadow-lg px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600 hover:border-indigo-200"
        >
          Back to top
        </button>
      </div>
    </div>
  );
};

export default JobDetail;
