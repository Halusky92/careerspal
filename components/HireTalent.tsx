
import React, { useState, useMemo } from 'react';
import { MOCK_CANDIDATES } from '../constants';
import { Candidate } from '../types';

interface HireTalentProps {
  onPostJob: () => void;
}

const HireTalent: React.FC<HireTalentProps> = ({ onPostJob }) => {
  const [view, setView] = useState<'landing' | 'browse'>('landing');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  // Filter states
  const [skillFilter, setSkillFilter] = useState('All');
  const [levelFilter, setLevelFilter] = useState('All');

  const filteredCandidates = useMemo(() => {
    return MOCK_CANDIDATES.filter(c => {
      const matchSkill = skillFilter === 'All' || c.skills.some(s => s.includes(skillFilter));
      const matchLevel = levelFilter === 'All' || c.level === levelFilter;
      return matchSkill && matchLevel;
    });
  }, [skillFilter, levelFilter]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);
  };

  const handleRequestIntro = (candidateId: string) => {
    alert("Intro Request Sent! Our elite recruiters will connect you shortly.");
  };

  // --- BROWSE VIEW ---
  if (view === 'browse') {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-in fade-in">
        <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
          <div>
            <button onClick={() => setView('landing')} className="text-sm font-bold text-slate-400 hover:text-indigo-600 mb-2 flex items-center gap-2 transition-colors">
              ← Back to Overview
            </button>
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
              Elite <span className="text-indigo-600">Talent Pool.</span>
            </h1>
            <p className="text-xl text-slate-500 font-medium mt-2">Curated list of Notion Architects & Ops Leaders available now.</p>
          </div>
          <div className="flex gap-4">
             <button onClick={() => setView('landing')} className="hidden md:block text-slate-500 font-bold px-4 hover:text-indigo-600">How it works?</button>
             <button onClick={onPostJob} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black shadow-xl hover:scale-105 transition-transform">Post a Role</button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm mb-12 flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1 w-full">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-3 mb-1 block">Primary Skill</label>
            <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
              {['All', 'Notion', 'Make', 'Zapier', 'Slack'].map(skill => (
                <button 
                  key={skill}
                  onClick={() => setSkillFilter(skill)}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${skillFilter === skill ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                >
                  {skill}
                </button>
              ))}
            </div>
          </div>
          <div className="w-px h-10 bg-slate-100 hidden md:block"></div>
          <div className="flex-1 w-full">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-3 mb-1 block">Experience Level</label>
            <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
               {['All', 'Mid', 'Senior', 'Lead', 'Architect'].map(level => (
                  <button 
                    key={level}
                    onClick={() => setLevelFilter(level)}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${levelFilter === level ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                  >
                    {level}
                  </button>
               ))}
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           {filteredCandidates.map(candidate => (
              <div key={candidate.id} className="bg-white rounded-[3rem] border border-slate-100 p-8 hover:shadow-2xl hover:border-indigo-100 transition-all group flex flex-col relative overflow-hidden">
                 {candidate.featured && (
                    <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[9px] font-black px-4 py-2 rounded-bl-2xl uppercase tracking-widest">
                       Featured
                    </div>
                 )}
                 
                 <div className="flex items-start justify-between mb-6">
                    <div>
                       <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">{candidate.level} Level</div>
                       <h3 className="text-xl font-black text-slate-900 leading-tight mb-2">{candidate.title}</h3>
                       {candidate.verified && (
                          <div className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wide border border-emerald-100">
                             <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                             Verified Pro
                          </div>
                       )}
                    </div>
                 </div>

                 <p className="text-slate-500 text-sm font-medium leading-relaxed mb-6 flex-1">
                    "{candidate.bio}"
                 </p>

                 {candidate.exCompanies && (
                    <div className="flex flex-wrap gap-2 mb-6">
                       {candidate.exCompanies.map(ex => (
                          <span key={ex} className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">{ex}</span>
                       ))}
                    </div>
                 )}

                 <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                       {candidate.skills.slice(0, 3).map(skill => (
                          <span key={skill} className="px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-[10px] font-black border border-slate-100 uppercase tracking-wider">
                             {skill}
                          </span>
                       ))}
                       {candidate.skills.length > 3 && (
                          <span className="px-2 py-1.5 bg-slate-50 text-slate-400 rounded-lg text-[10px] font-bold">+ {candidate.skills.length - 3}</span>
                       )}
                    </div>

                    <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                       <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Rate</p>
                          <p className="text-slate-900 font-black">{candidate.rate}</p>
                       </div>
                       <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Availability</p>
                          <p className="text-emerald-600 font-black">{candidate.availability}</p>
                       </div>
                    </div>

                    <button 
                       onClick={() => handleRequestIntro(candidate.id)}
                       className="w-full bg-white border-2 border-slate-100 text-slate-900 font-black py-4 rounded-2xl hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm active:scale-95"
                    >
                       Request Intro
                    </button>
                 </div>
              </div>
           ))}
        </div>
        
        <div className="mt-16 text-center">
           <p className="text-slate-400 font-bold mb-4">Looking for a specific skill set?</p>
           <button onClick={onPostJob} className="text-indigo-600 font-black underline hover:text-indigo-800">Post a targeted role instead</button>
        </div>
      </div>
    );
  }

  // --- LANDING VIEW ---
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 animate-in fade-in">
      <div className="text-center mb-16">
        <h1 className="text-5xl md:text-6xl font-black text-gray-900 mb-6 tracking-tight leading-[1.1]">
          Access the top <span className="text-indigo-600">1% Notion Ops Pool.</span>
        </h1>
        <p className="text-xl text-gray-500 max-w-3xl mx-auto font-medium">
          CareersPal Elite is the go-to destination for high-growth remote companies looking for world-class systems and operations talent.
        </p>
        <div className="mt-12 flex flex-col items-center justify-center gap-4">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 w-full">
            <button 
              onClick={() => setView('browse')}
              className="w-full sm:w-auto px-10 py-5 rounded-[2rem] font-black text-xl transition-all active:scale-95 shadow-2xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200 flex items-center justify-center gap-3"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              Browse Talent
            </button>
            <button 
              onClick={onPostJob}
              className="w-full sm:w-auto bg-white text-slate-900 border-2 border-slate-100 px-10 py-5 rounded-[2rem] font-black text-xl hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
            >
              Post a Role – from $79
            </button>
          </div>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">
            30-day listing • AI Matching included • Money-back guarantee
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-24">
        {[
          { title: 'Notion Specialists', desc: 'Pre-vetted professionals with deep expertise in workspace architecture and database design.', icon: '📘' },
          { title: 'Automation Pros', desc: 'Experts in Zapier, Make.com, and API integrations to automate your manual processes.', icon: '⚡' },
          { title: 'Ops Leaders', desc: 'Fractional and full-time COOs and Ops Managers who build the foundations of your company.', icon: '🏗️' }
        ].map(feature => (
          <div key={feature.title} className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all group">
            <div className="text-5xl mb-6 group-hover:scale-110 transition-transform inline-block">{feature.icon}</div>
            <h3 className="text-2xl font-black text-gray-900 mb-4">{feature.title}</h3>
            <p className="text-gray-500 leading-relaxed font-medium">{feature.desc}</p>
          </div>
        ))}
      </div>

      {/* Talent Join CTA */}
      <div className="bg-slate-900 rounded-[4rem] p-12 md:p-20 text-center relative overflow-hidden">
         <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-black text-white mb-6">Are you a Notion Architect?</h2>
            <p className="text-slate-400 text-lg mb-10 max-w-2xl mx-auto">Join the Elite Talent Pool and get discovered by the world's best remote companies. No spam, just high-quality intros.</p>
            <button 
               onClick={() => {
                  setShowProfileModal(true);
                  setIsSubmitted(false);
               }}
               className="bg-white text-slate-900 px-10 py-5 rounded-[2rem] font-black text-lg hover:bg-indigo-50 transition-colors"
            >
               Join as Talent
            </button>
         </div>
         <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500 rounded-full blur-[150px] transform translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500 rounded-full blur-[150px] transform -translate-x-1/2 translate-y-1/2"></div>
         </div>
      </div>

      {/* Talent Profile Settings Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xl animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-8 md:p-12 border-b flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">Talent Onboarding</h2>
                <p className="text-gray-500 font-medium">Join the elite Notion Ops network</p>
              </div>
              <button onClick={() => setShowProfileModal(false)} className="p-3 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-8 md:p-12 space-y-10 max-h-[70vh] overflow-y-auto no-scrollbar">
              {!isSubmitted ? (
                <form onSubmit={handleSubmit} className="space-y-10">
                  <div className="space-y-6">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.3em]">Core Identity</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input type="text" required placeholder="Full Name" className="bg-gray-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-4 focus:ring-indigo-100 outline-none w-full" />
                      <input type="email" required placeholder="Work Email" className="bg-gray-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-4 focus:ring-indigo-100 outline-none w-full" />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.3em]">Notion Credentials</h3>
                    <input type="url" placeholder="Public Notion Portfolio URL (https://notion.site/...)" className="bg-gray-50 border-none rounded-2xl px-6 py-4 text-sm font-bold focus:ring-4 focus:ring-indigo-100 outline-none w-full" />
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.3em]">System Expertise</h3>
                    <div className="flex flex-wrap gap-3">
                      {['Notion', 'Zapier', 'Make.com', 'Airtable', 'Slack Ops', 'Retool'].map(skill => (
                        <label key={skill} className="flex items-center gap-3 bg-gray-50 px-5 py-3 rounded-2xl cursor-pointer hover:bg-indigo-50 transition-colors border border-transparent has-[:checked]:border-indigo-200 has-[:checked]:bg-indigo-50/50">
                          <input type="checkbox" className="w-5 h-5 rounded-lg border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                          <span className="text-sm font-bold text-gray-700">{skill}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <button type="submit" className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all text-lg active:scale-95">
                    Complete Onboarding
                  </button>
                </form>
              ) : (
                <div className="py-12 text-center space-y-8 animate-in zoom-in-95">
                  <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-4xl">✓</div>
                  <div>
                    <h3 className="text-3xl font-black text-gray-900 mb-4">You're in the pool!</h3>
                    <p className="text-gray-500 font-medium max-w-sm mx-auto">
                      Our systems are now matching your expertise with elite Notion-first companies. Expect alerts soon.
                    </p>
                  </div>
                  <button 
                    onClick={() => setShowProfileModal(false)}
                    className="bg-gray-900 text-white px-10 py-4 rounded-2xl font-black hover:bg-slate-800 transition-all"
                  >
                    Back to Ecosystem
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HireTalent;
