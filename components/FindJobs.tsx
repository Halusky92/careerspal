
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Job } from '../types';
import { CATEGORIES } from '../constants';

interface FindJobsProps {
  jobs: Job[];
  onSelectJob: (job: Job) => void;
  onSelectCompany: (companyName: string) => void;
  initialQuery?: string;
  user: any;
  onToggleBookmark: (jobId: string) => void;
}

const JOBS_PER_PAGE = 7;

const FindJobs: React.FC<FindJobsProps> = ({ jobs, onSelectJob, onSelectCompany, initialQuery = '', user, onToggleBookmark }) => {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState('All Roles');
  const [system, setSystem] = useState('All Systems');
  const [sortBy, setSortBy] = useState<'newest' | 'salary'>('newest');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  
  // Pagination State
  const [visibleCount, setVisibleCount] = useState(JOBS_PER_PAGE);

  const systems = ['All Systems', 'Notion', 'Zapier', 'Make.com', 'Airtable'];

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(JOBS_PER_PAGE);
  }, [query, category, system, sortBy]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getSalaryValue = (salary: string) => {
    const match = salary.match(/\$(\d+)/);
    if (match) return parseInt(match[1]) * 1000;
    return 0;
  };

  // Helper to determine salary competitiveness
  const getSalaryLevel = (salary: string) => {
    const val = getSalaryValue(salary);
    if (val > 140000) return { label: 'Top 5%', color: 'bg-emerald-500', width: '95%' };
    if (val > 110000) return { label: 'High', color: 'bg-indigo-500', width: '75%' };
    if (val > 80000) return { label: 'Market', color: 'bg-blue-400', width: '50%' };
    return { label: 'Entry', color: 'bg-slate-300', width: '30%' };
  };

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { 'All Roles': jobs.length };
    CATEGORIES.forEach(cat => {
      if (cat !== 'All Roles') {
        counts[cat] = jobs.filter(j => j.category === cat).length;
      }
    });
    return counts;
  }, [jobs]);

  const filteredAndSorted = useMemo(() => {
    let result = jobs.filter(j => {
      const matchesQuery = j.title.toLowerCase().includes(query.toLowerCase()) || 
                          j.company.toLowerCase().includes(query.toLowerCase()) ||
                          j.tags.some(t => t.toLowerCase().includes(query.toLowerCase()));
      const matchesCat = category === 'All Roles' || j.category === category;
      const matchesSystem = system === 'All Systems' || j.tags.some(t => t.includes(system));
      return matchesQuery && matchesCat && matchesSystem;
    });

    // Sort order: Elite -> Featured -> Standard, then by user sort
    result = result.sort((a, b) => {
      const planWeight = { 'Elite Managed': 3, 'Featured Pro': 2, 'Standard': 1 };
      const weightA = planWeight[a.planType || 'Standard'] || 1;
      const weightB = planWeight[b.planType || 'Standard'] || 1;
      
      if (weightA !== weightB) return weightB - weightA;

      if (sortBy === 'salary') {
        return getSalaryValue(b.salary) - getSalaryValue(a.salary);
      }
      
      // Secondary Sort: Date (Newest First) if weights are equal and not sorting by salary
      const timeA = (a as any).timestamp || 0;
      const timeB = (b as any).timestamp || 0;
      return timeB - timeA;
    });
    
    return result;
  }, [jobs, query, category, system, sortBy]);

  const suggestions = useMemo(() => {
    if (!query.trim() || query.length < 1) return [];
    const lowQuery = query.toLowerCase();
    
    const titles = jobs.filter(j => j.title.toLowerCase().includes(lowQuery)).map(j => j.title);
    const companies = jobs.filter(j => j.company.toLowerCase().includes(lowQuery)).map(j => j.company);
    const tags = jobs.flatMap(j => j.tags).filter(t => t.toLowerCase().includes(lowQuery));
    
    return Array.from(new Set([...titles, ...companies, ...tags])).slice(0, 5);
  }, [query, jobs]);

  // Helper to check for "New" badge
  const isNewListing = (postedAt: string) => {
    const lower = postedAt.toLowerCase();
    return lower.includes('just now') || lower.includes('hour') || lower.includes('min');
  };

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + JOBS_PER_PAGE);
  };

  const FilterContent = () => (
    <div className="space-y-10 sticky top-24">
      <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Expertise Segments</h3>
        <div className="space-y-1.5">
          {CATEGORIES.map(cat => (
            <button 
              key={cat} 
              onClick={() => { setCategory(cat); if(window.innerWidth < 1024) setIsFilterOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition-all group ${category === cat ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <span>{cat}</span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${category === cat ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-400'}`}>
                {categoryCounts[cat] || 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Systems Stack</h3>
        <div className="space-y-2">
          {systems.map(s => (
            <button 
              key={s} 
              onClick={() => setSystem(s)}
              className={`w-full text-left px-4 py-3 rounded-2xl text-sm font-bold transition-all ${system === s ? 'bg-slate-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="mb-12 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div>
          <h1 className="text-5xl font-black text-slate-900 tracking-tight mb-4">
            Browse the <span className="text-indigo-600 text-gradient">Elite Board.</span>
          </h1>
          <p className="text-xl text-slate-500 font-medium italic">
            The home of elite Operations, Product & Automation talent.
          </p>
        </div>

        <div className="flex bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm self-center lg:self-end">
          <button 
            onClick={() => setSortBy('newest')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${sortBy === 'newest' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Newest
          </button>
          <button 
            onClick={() => setSortBy('salary')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${sortBy === 'salary' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Salary
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-12">
        <aside className="hidden lg:block lg:w-80 space-y-10 relative">
          <FilterContent />
        </aside>

        <div className="flex-1 space-y-8">
          <div ref={searchRef} className="relative group sticky top-24 z-30">
            <div className="relative flex items-center bg-white/90 backdrop-blur-md border border-slate-100 rounded-[2.5rem] shadow-lg focus-within:ring-4 focus-within:ring-indigo-100 transition-all overflow-hidden">
              <div className="pl-8 text-slate-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <input 
                type="text" 
                placeholder="Search by role, company or tool (e.g. Notion, Make)..." 
                className="w-full px-6 py-7 bg-transparent outline-none text-xl font-medium placeholder:text-slate-300"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
              />
              {query && (
                <button 
                  onClick={() => { setQuery(''); setShowSuggestions(false); }}
                  className="p-3 mr-4 text-slate-300 hover:text-indigo-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>

            {/* PREDICTIVE SUGGESTIONS */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-indigo-50 rounded-[2rem] shadow-2xl overflow-hidden z-40">
                {suggestions.map((suggestion, idx) => (
                  <button 
                    key={idx}
                    onClick={() => {
                      setQuery(suggestion);
                      setShowSuggestions(false);
                    }}
                    className="w-full text-left px-8 py-4 text-lg font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors border-b border-indigo-50/50 last:border-none flex items-center gap-4"
                  >
                    <svg className="w-4 h-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-5">
            {filteredAndSorted.slice(0, visibleCount).map(job => {
              const isElite = job.planType === 'Elite Managed';
              const isPro = job.planType === 'Featured Pro';
              const isStandard = !isElite && !isPro;
              const isNew = isNewListing(job.postedAt);
              // Check if job is saved in the user object
              const isSaved = user?.savedJobIds?.includes(job.id);
              const salaryStats = getSalaryLevel(job.salary);

              return (
                <div 
                  key={job.id} 
                  onClick={() => onSelectJob(job)}
                  className={`
                    p-8 rounded-[3.5rem] transition-all cursor-pointer group flex flex-col md:flex-row items-center justify-between gap-6 relative active:scale-[0.99] animate-in fade-in slide-in-from-bottom-2
                    ${isElite 
                      ? 'bg-slate-900 border-2 border-slate-800 shadow-2xl text-white' 
                      : isPro 
                        ? 'bg-white border-2 border-indigo-200 shadow-xl shadow-indigo-100 ring-4 ring-indigo-50/50' 
                        : 'bg-white border border-gray-50 shadow-sm hover:shadow-2xl hover:border-indigo-100'}
                  `}
                >
                  {/* Badges for Elite/Pro */}
                  {(isElite || isPro) && (
                    <div className={`absolute -top-3 left-10 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-md
                      ${isElite ? 'bg-gradient-to-r from-amber-300 to-yellow-500 text-slate-900' : 'bg-indigo-600 text-white'}`}>
                      {isElite ? 'Elite Managed' : 'Featured'}
                    </div>
                  )}

                  {/* New Listing Badge - Adjusted Position */}
                  {isNew && (
                    <div className="absolute -top-3 right-14 animate-pulse z-20">
                      <span className="bg-red-500 text-white text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-red-200 shadow-lg border-2 border-white">New Drop</span>
                    </div>
                  )}

                  {/* Bookmark Button - MOVED HIGHER (top-2) */}
                  <button 
                     onClick={(e) => { e.stopPropagation(); onToggleBookmark(job.id); }}
                     className={`absolute top-2 right-4 p-2.5 rounded-full transition-all z-30 hover:scale-110
                       ${isSaved 
                         ? 'text-pink-500 bg-pink-50' 
                         : isElite ? 'text-slate-500 hover:text-white hover:bg-white/10' : 'text-slate-300 hover:text-pink-400 hover:bg-pink-50'
                       }`}
                     title={isSaved ? "Saved" : "Save"}
                  >
                     <svg className="w-5 h-5" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                  </button>

                  <div className="flex items-center gap-8 w-full md:w-auto">
                    <div className={`
                      w-20 h-20 rounded-[1.8rem] flex items-center justify-center overflow-hidden p-1.5 flex-shrink-0
                      ${isElite ? 'bg-white/10 border border-white/20' : 'bg-gray-50 border border-gray-100'}
                    `}>
                      <img src={job.logo} alt="" className="w-full h-full object-contain" />
                    </div>
                    
                    {/* Added pr-12 to prevent text overlap with heart button */}
                    <div className="flex-1 min-w-0 pr-12">
                      <h3 className={`text-2xl font-black tracking-tight leading-tight truncate ${isElite ? 'text-white' : 'text-slate-900 group-hover:text-indigo-600'} transition-colors`}>{job.title}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <button 
                           onClick={(e) => { e.stopPropagation(); onSelectCompany(job.company); }}
                           className={`font-bold uppercase text-xs tracking-wider hover:underline z-10 relative truncate ${isElite ? 'text-indigo-300' : 'text-indigo-600'}`}
                        >
                           {job.company}
                        </button>
                        <span className={`text-[10px] ${isElite ? 'text-slate-500' : 'text-slate-300'}`}>•</span>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isElite ? 'text-slate-400' : 'text-slate-400'}`}>{job.location}</span>
                      </div>
                      <div className="flex gap-2 mt-4">
                        {job.tools?.map(tool => (
                          <span key={tool} className={`
                            text-[9px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-widest
                            ${isElite ? 'bg-white/10 text-slate-300 border-white/10' : 'bg-slate-50 text-slate-400 border-slate-100'}
                          `}>
                            {tool}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-right w-full md:w-auto border-t md:border-none pt-4 md:pt-0 border-slate-100/10">
                    <div className={`text-3xl font-black tracking-tighter ${isElite ? 'text-white' : 'text-slate-900'}`}>{job.salary}</div>
                    
                    {/* Salary Competitiveness Meter */}
                    <div className="flex items-center justify-end gap-2 mt-1 mb-2">
                       <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${salaryStats.color}`} style={{ width: salaryStats.width }}></div>
                       </div>
                       <span className={`text-[9px] font-black uppercase tracking-widest ${isElite ? 'text-slate-400' : 'text-slate-400'}`}>{salaryStats.label}</span>
                    </div>

                    <div className="flex items-center justify-end gap-3">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${isElite ? 'text-slate-500' : 'text-slate-300'}`}>{job.postedAt}</span>
                      {job.matchScore && (
                        <span className={`text-[10px] font-black px-2 py-1 rounded-lg border ${isElite ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}>Match {job.matchScore}%</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Load More Button */}
            {filteredAndSorted.length > visibleCount && (
               <div className="pt-8 pb-4 text-center">
                  <button 
                     onClick={handleLoadMore}
                     className="bg-white border-2 border-slate-100 text-slate-600 px-8 py-4 rounded-[2rem] font-black uppercase tracking-widest text-xs hover:border-indigo-600 hover:text-indigo-600 transition-all shadow-sm active:scale-95"
                  >
                     Show More Roles ({filteredAndSorted.length - visibleCount} remaining)
                  </button>
               </div>
            )}

            {filteredAndSorted.length === 0 && (
              <div className="bg-white py-20 rounded-[3.5rem] text-center border-2 border-dashed border-slate-100">
                <p className="text-slate-400 font-bold italic">No elite roles found matching your current search.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FindJobs;
