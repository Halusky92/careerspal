
import React, { useState, useMemo } from 'react';
import { Job, ResumeAudit } from '../types';
import { MOCK_JOBS } from '../constants';
import { auditCandidateProfile } from '../services/geminiService';

interface CandidateDashboardProps {
  onBrowse: () => void;
  user: any;
  allJobs: Job[];
}

const CandidateDashboard: React.FC<CandidateDashboardProps> = ({ onBrowse, user, allJobs }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'applications' | 'saved'>('overview');
  
  // AI Audit States
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [resumeText, setResumeText] = useState('');
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<ResumeAudit | null>(null);
  const [profileScore, setProfileScore] = useState(65); // Initial static score

  // Mock data pre ukážku
  const applications = [
    { job: MOCK_JOBS[0], status: 'Interview', date: '2 days ago', step: 2 },
    { job: MOCK_JOBS[2], status: 'Applied', date: '1 week ago', step: 1 },
  ];

  // REAL SAVED JOBS FROM USER PROFILE
  const savedJobs = useMemo(() => {
    if (!user || !user.savedJobIds) return [];
    return allJobs.filter(job => user.savedJobIds.includes(job.id));
  }, [user, allJobs]);

  const handleAudit = async () => {
    if (!resumeText.trim()) return;
    setIsAuditing(true);
    try {
      const result = await auditCandidateProfile(resumeText);
      setAuditResult(result);
      setProfileScore(result.score);
    } catch (e) {
      alert("AI Analysis failed. Please try again.");
    } finally {
      setIsAuditing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Interview': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Applied': return 'bg-blue-50 text-blue-600 border-blue-100';
      case 'Offer': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default: return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  };

  const Steps = ({ current }: { current: number }) => (
    <div className="flex items-center gap-1 mt-2">
      {[1, 2, 3, 4].map(step => (
        <div 
          key={step} 
          className={`h-1.5 flex-1 rounded-full ${step <= current ? 'bg-indigo-600' : 'bg-slate-100'}`}
        />
      ))}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-2">My Career Hub.</h1>
          <p className="text-slate-500 font-medium">Welcome back, Architect.</p>
        </div>
        <button onClick={onBrowse} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black shadow-xl hover:scale-105 transition-transform">
          Find New Roles
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar Profile */}
        <div className="lg:col-span-4 space-y-8">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
            <div className="relative z-10">
              <div className="w-24 h-24 bg-white rounded-[2rem] p-1.5 shadow-lg -mt-4 mb-4">
                <img 
                  src="https://raw.githubusercontent.com/stackblitz/stackblitz-images/main/marek-bilek-avatar.jpg" 
                  onError={(e) => (e.target as HTMLImageElement).src = 'https://i.pravatar.cc/150?img=11'}
                  alt="Profile" 
                  className="w-full h-full object-cover rounded-[1.5rem]" 
                />
              </div>
              <h2 className="text-2xl font-black text-slate-900">{user?.email ? user.email.split('@')[0] : 'Guest Talent'}</h2>
              <p className="text-indigo-600 font-bold text-sm uppercase tracking-widest mb-6">Senior Product Ops</p>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm font-bold">
                  <span className="text-slate-500">Profile Strength</span>
                  <span className={`${profileScore > 80 ? 'text-emerald-500' : 'text-amber-500'}`}>{profileScore}%</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ${profileScore > 80 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : 'bg-gradient-to-r from-amber-300 to-amber-500'}`}
                    style={{ width: `${profileScore}%` }}
                  ></div>
                </div>
                <button 
                  onClick={() => setShowAuditModal(true)}
                  className="w-full mt-2 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-600 transition-colors shadow-lg"
                >
                  ⚡ Boost with AI
                </button>
              </div>

              <div className="mt-8 flex flex-wrap gap-2">
                {['Notion', 'Linear', 'Figma', 'Zapier'].map(tag => (
                  <span key={tag} className="px-3 py-1 bg-slate-50 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-wider border border-slate-100">{tag}</span>
                ))}
                {auditResult?.missingKeywords?.slice(0, 2).map(keyword => (
                  <span key={keyword} className="px-3 py-1 bg-red-50 text-red-400 rounded-lg text-[10px] font-black uppercase tracking-wider border border-red-100 dashed border-dashed animate-pulse" title="Missing keyword identified by AI">
                    + {keyword}?
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-lg shadow-indigo-200">
             <h3 className="text-lg font-black mb-1">Elite Status</h3>
             <p className="text-indigo-200 text-sm font-medium mb-6">Your profile is visible to top-tier employers.</p>
             <div className="flex items-center gap-4">
                <div className="flex-1 bg-white/10 rounded-xl p-3 text-center backdrop-blur-sm">
                   <div className="text-2xl font-black">14</div>
                   <div className="text-[9px] uppercase tracking-widest opacity-70">Views</div>
                </div>
                <div className="flex-1 bg-white/10 rounded-xl p-3 text-center backdrop-blur-sm">
                   <div className="text-2xl font-black">2</div>
                   <div className="text-[9px] uppercase tracking-widest opacity-70">Intros</div>
                </div>
             </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-8 space-y-8">
          {/* Tabs */}
          <div className="flex gap-2 p-1.5 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
            {['overview', 'applications', 'saved'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`flex-1 py-3 px-6 rounded-xl text-sm font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  activeTab === tab 
                    ? 'bg-slate-900 text-white shadow-md' 
                    : 'text-slate-400 hover:bg-slate-50'
                }`}
              >
                {tab} {tab === 'saved' && savedJobs.length > 0 && `(${savedJobs.length})`}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 fade-in">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Active Application Card */}
                  <div className="bg-white p-8 rounded-[2.5rem] border border-indigo-100 shadow-sm relative overflow-hidden group hover:shadow-xl transition-all cursor-pointer">
                     <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                        <svg className="w-24 h-24 text-indigo-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14l9-5-9-5-9 5 9 5z" /><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>
                     </div>
                     <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-4">Latest Activity</p>
                     <h3 className="text-2xl font-black text-slate-900 mb-1">Interview Request</h3>
                     <p className="text-slate-500 font-medium mb-6">FlowState Systems wants to chat.</p>
                     <div className="flex items-center gap-4">
                        <img src={MOCK_JOBS[0].logo} className="w-10 h-10 rounded-full border border-slate-100" alt="" />
                        <button className="bg-slate-900 text-white px-5 py-2 rounded-xl text-xs font-black">Respond</button>
                     </div>
                  </div>

                  {/* AI Recommendation */}
                  <div className="bg-gradient-to-br from-indigo-50 to-white p-8 rounded-[2.5rem] border border-indigo-100 shadow-sm">
                     <div className="flex justify-between items-start mb-4">
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">AI Pick</p>
                        <span className="bg-emerald-100 text-emerald-600 px-2 py-1 rounded-md text-[9px] font-black">98% Match</span>
                     </div>
                     <h3 className="text-xl font-black text-slate-900 mb-2">Systems Architect</h3>
                     <p className="text-slate-500 text-sm font-medium mb-6">Based on your expertise in Make.com, this role at Automately is a perfect fit.</p>
                     <button onClick={onBrowse} className="text-indigo-600 text-sm font-black hover:underline">View Details →</button>
                  </div>
               </div>

               <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                  <div className="flex justify-between items-center mb-8">
                     <h3 className="text-lg font-black text-slate-900">Application Pipeline</h3>
                     <button onClick={() => setActiveTab('applications')} className="text-slate-400 text-xs font-bold hover:text-indigo-600">View All</button>
                  </div>
                  <div className="space-y-6">
                     {applications.map((app, idx) => (
                        <div key={idx} className="flex items-center gap-6 p-4 rounded-3xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                           <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center p-2 border border-slate-100">
                              <img src={app.job.logo} alt="" className="w-full h-full object-contain" />
                           </div>
                           <div className="flex-1">
                              <div className="flex justify-between mb-2">
                                 <h4 className="font-black text-slate-900">{app.job.title}</h4>
                                 <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusColor(app.status)}`}>
                                    {app.status}
                                 </span>
                              </div>
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">{app.job.company} • Applied {app.date}</p>
                              <Steps current={app.step} />
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'applications' && (
             <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm animate-in fade-in">
                <h3 className="text-lg font-black text-slate-900 mb-8">All Applications</h3>
                {/* Reusing logic from overview for full list */}
                <div className="space-y-6">
                  {applications.map((app, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-6 p-6 rounded-3xl bg-slate-50 border border-slate-100">
                        <div className="flex items-center gap-4">
                           <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center p-2 border border-slate-100 shadow-sm">
                              <img src={app.job.logo} alt="" className="w-full h-full object-contain" />
                           </div>
                           <div>
                              <h4 className="font-black text-slate-900">{app.job.title}</h4>
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{app.job.company}</p>
                           </div>
                        </div>
                        <div className="flex-1 sm:pl-8">
                           <div className="flex justify-between items-center mb-2">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">Status</span>
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusColor(app.status)}`}>
                                 {app.status}
                              </span>
                           </div>
                           <Steps current={app.step} />
                        </div>
                     </div>
                  ))}
                </div>
             </div>
          )}

          {activeTab === 'saved' && (
             <div className="space-y-4 animate-in fade-in">
                {savedJobs.length > 0 ? savedJobs.map(job => (
                   <div key={job.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-lg transition-all flex items-center justify-between group">
                      <div className="flex items-center gap-6">
                         <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center p-2">
                            <img src={job.logo} alt="" className="w-full h-full object-contain" />
                         </div>
                         <div>
                            <h4 className="font-black text-slate-900 text-lg group-hover:text-indigo-600 transition-colors">{job.title}</h4>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{job.company} • {job.salary}</p>
                         </div>
                      </div>
                      <button className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-xs hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100">
                         Apply
                      </button>
                   </div>
                )) : (
                  <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-200">
                    <p className="text-slate-400 font-bold italic mb-4">You haven't saved any roles yet.</p>
                    <button onClick={onBrowse} className="text-indigo-600 font-black hover:underline">Go to Job Board</button>
                  </div>
                )}
                
                {savedJobs.length > 0 && (
                  <div className="text-center py-10">
                    <button onClick={onBrowse} className="text-slate-400 font-bold hover:text-indigo-600 transition-colors text-sm">Browse more roles →</button>
                  </div>
                )}
             </div>
          )}
        </div>
      </div>

      {/* AI Resume Audit Modal */}
      {showAuditModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white w-full max-w-3xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col md:flex-row max-h-[85vh]">
             
             {/* Left Panel: Input */}
             <div className="w-full md:w-1/2 p-8 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                   <h3 className="text-xl font-black text-slate-900">Profile Scan</h3>
                   <button onClick={() => setShowAuditModal(false)} className="text-slate-400 hover:text-red-500 font-bold text-xs uppercase tracking-widest">Close</button>
                </div>
                <p className="text-slate-500 text-sm font-medium mb-4">Paste your Bio or Resume summary below. Our AI recruiter will audit it against elite standards.</p>
                
                <textarea 
                  className="flex-1 w-full bg-slate-50 rounded-2xl border-none p-4 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 resize-none mb-4"
                  placeholder="e.g. Senior Operations Manager with 5 years experience in building Notion workspaces..."
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                ></textarea>
                
                <button 
                  onClick={handleAudit} 
                  disabled={isAuditing || !resumeText}
                  className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isAuditing ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      Scanning...
                    </>
                  ) : 'Run Audit'}
                </button>
             </div>

             {/* Right Panel: Results */}
             <div className="w-full md:w-1/2 bg-slate-50 p-8 overflow-y-auto">
                {!auditResult ? (
                   <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                      <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center text-4xl mb-4">🤖</div>
                      <p className="font-black text-slate-900">AI Idle</p>
                      <p className="text-sm font-bold text-slate-500">Waiting for data...</p>
                   </div>
                ) : (
                   <div className="space-y-8 animate-in slide-in-from-right-4">
                      <div className="text-center">
                         <div className="inline-flex items-center justify-center w-24 h-24 rounded-full border-4 border-white shadow-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white mb-4">
                            <span className="text-3xl font-black">{auditResult.score}</span>
                         </div>
                         <h4 className="text-lg font-black text-slate-900">Elite Score</h4>
                         <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{auditResult.headline}</p>
                      </div>

                      <div className="space-y-4">
                         <div className="bg-white p-5 rounded-2xl shadow-sm">
                            <h5 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-3">Key Strengths</h5>
                            <div className="flex flex-wrap gap-2">
                               {auditResult.strengths.map((s, i) => (
                                  <span key={i} className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-md border border-emerald-100">{s}</span>
                               ))}
                            </div>
                         </div>

                         <div className="bg-white p-5 rounded-2xl shadow-sm border-l-4 border-red-400">
                            <h5 className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-3">Missing Keywords</h5>
                            <div className="flex flex-wrap gap-2">
                               {auditResult.missingKeywords.map((k, i) => (
                                  <span key={i} className="px-2 py-1 bg-red-50 text-red-600 text-[10px] font-bold rounded-md border border-red-100">{k}</span>
                               ))}
                            </div>
                         </div>

                         <div className="bg-indigo-600 p-5 rounded-2xl shadow-lg text-white">
                            <h5 className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-2">Recommended Action</h5>
                            <p className="text-sm font-medium leading-relaxed">{auditResult.actionPlan}</p>
                         </div>
                      </div>
                   </div>
                )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CandidateDashboard;
