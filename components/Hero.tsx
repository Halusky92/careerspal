
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Job } from '../types';

interface HeroProps {
  onBrowse: () => void;
  onJoinPool: () => void;
  onSearch: (query: string) => void;
  jobs: Job[];
}

// Definícia uzlov siete pre presné prepojenie čiar a log
const NODES = [
  { id: 'notion', label: 'Notion', icon: 'https://upload.wikimedia.org/wikipedia/commons/e/e9/Notion-logo.svg', x: 15, y: 20 },
  { id: 'google', label: 'Google', icon: 'https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg', x: 50, y: 12 },
  { id: 'zapier', label: 'Zapier', icon: 'https://cdn.worldvectorlogo.com/logos/zapier.svg', x: 85, y: 20 },
  { id: 'airtable', label: 'Airtable', icon: 'https://upload.wikimedia.org/wikipedia/commons/4/4b/Airtable_Logo.svg', x: 85, y: 60 },
  { id: 'slack', label: 'Slack', icon: 'https://upload.wikimedia.org/wikipedia/commons/d/d5/Slack_icon_2019.svg', x: 70, y: 85 },
  { id: 'gemini', label: 'Gemini', icon: 'https://upload.wikimedia.org/wikipedia/commons/8/8a/Google_Gemini_logo.svg', x: 30, y: 85 },
  { id: 'center', label: 'C', icon: '', x: 50, y: 50, isCenter: true }, // Centrálny uzol
];

// Definícia prepojení (odkiaľ -> kam)
const CONNECTIONS = [
  ['notion', 'google'],
  ['google', 'zapier'],
  ['zapier', 'airtable'],
  ['airtable', 'slack'],
  ['slack', 'gemini'],
  ['gemini', 'notion'],
  // Prepojenia do stredu
  ['notion', 'center'],
  ['google', 'center'],
  ['zapier', 'center'],
  ['airtable', 'center'],
  ['slack', 'center'],
  ['gemini', 'center'],
];

const Hero: React.FC<HeroProps> = ({ onBrowse, onJoinPool, onSearch, jobs }) => {
  const [query, setQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    if (!query.trim() || query.length < 1) return [];
    const lowQuery = query.toLowerCase();
    
    const titles = jobs.filter(j => j.title.toLowerCase().includes(lowQuery)).map(j => j.title);
    const companies = jobs.filter(j => j.company.toLowerCase().includes(lowQuery)).map(j => j.company);
    const tags = jobs.flatMap(j => j.tags).filter(t => t.toLowerCase().includes(lowQuery));
    
    return Array.from(new Set([...titles, ...companies, ...tags])).slice(0, 5);
  }, [query, jobs]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (overriddenQuery?: string) => {
    const finalQuery = overriddenQuery || query;
    if (finalQuery.trim()) {
      onSearch(finalQuery);
      setShowSuggestions(false);
    }
  };

  return (
    <div className="relative pt-12 pb-20 sm:pt-20 sm:pb-24 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-15%] w-[80%] h-[80%] bg-indigo-300/20 rounded-full blur-[100px] sm:blur-[160px] animate-pulse opacity-60"></div>
        <div className="absolute bottom-[-15%] right-[-10%] w-[70%] h-[70%] bg-violet-400/20 rounded-full blur-[100px] sm:blur-[160px] animate-pulse opacity-60" style={{ animationDelay: '3.5s' }}></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center lg:text-left">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-16">
          <div className="flex-1 w-full">
            <div className="inline-flex items-center space-x-2 bg-indigo-50/50 backdrop-blur border border-indigo-100 px-4 py-2 rounded-full mb-6 sm:mb-8 shadow-sm">
              <span className="flex h-2 w-2 rounded-full bg-indigo-600 animate-pulse"></span>
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">The Systems & Ops Ecosystem</span>
            </div>
            
            <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-slate-900 tracking-tight leading-[1.1] sm:leading-[0.9] mb-6 sm:mb-8">
              The Hub for <br />
              <span className="text-gradient">Notion-first Ops.</span>
            </h1>
            
            <p className="max-w-xl mx-auto lg:mx-0 text-base sm:text-lg md:text-xl text-slate-500 font-medium leading-relaxed mb-8 sm:mb-10">
              The premier job board for Notion Architects, Operations Managers, and Automation experts building the future.
            </p>
            
            {/* ENHANCED SEARCH BAR */}
            <div ref={searchRef} className="max-w-xl mx-auto lg:mx-0 relative mb-8 sm:mb-10 group">
              <div className="relative flex items-center bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden focus-within:ring-4 focus-within:ring-indigo-100 transition-all">
                <div className="pl-5 text-slate-300">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <input 
                  type="text" 
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Search role, company or stack..."
                  className="w-full px-4 py-4 sm:py-5 text-sm sm:text-base font-bold text-slate-900 outline-none placeholder:text-slate-300 placeholder:font-medium"
                />
                
                {query && (
                  <button 
                    onClick={() => { setQuery(''); setShowSuggestions(false); }}
                    className="p-2 mr-2 text-slate-300 hover:text-indigo-600 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}

                <button 
                  onClick={() => handleSearchSubmit()}
                  className="bg-indigo-600 text-white px-6 py-4 sm:py-5 font-black text-xs sm:text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-95"
                >
                  Search
                </button>
              </div>

              {/* PREDICTIVE SUGGESTIONS */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white/90 backdrop-blur-xl border border-indigo-50 rounded-2xl shadow-2xl overflow-hidden z-50">
                  {suggestions.map((suggestion, idx) => (
                    <button 
                      key={idx}
                      onClick={() => {
                        setQuery(suggestion);
                        handleSearchSubmit(suggestion);
                      }}
                      className="w-full text-left px-6 py-3.5 text-sm font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors border-b border-indigo-50/50 last:border-none flex items-center gap-3"
                    >
                      <svg className="w-3.5 h-3.5 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 sm:gap-5">
              <button 
                onClick={onBrowse}
                className="w-full sm:w-auto bg-indigo-600 text-white px-8 sm:px-10 py-4 sm:py-5 rounded-2xl sm:rounded-[1.8rem] font-black text-base sm:text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95"
              >
                Browse Roles
              </button>
              <button 
                onClick={onJoinPool}
                className="w-full sm:w-auto bg-white/80 backdrop-blur text-slate-900 border border-slate-200 px-8 sm:px-10 py-4 sm:py-5 rounded-2xl sm:rounded-[1.8rem] font-black text-base sm:text-lg hover:bg-indigo-50 transition-all active:scale-95 shadow-sm"
              >
                Join Talent Pool
              </button>
            </div>
          </div>

          <div className="flex-1 relative w-full h-[400px] lg:h-[600px] hidden lg:block">
             <div className="absolute inset-0 w-full h-full">
                
                {/* 1. SVG Network Layer */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
                  {CONNECTIONS.map(([startId, endId], i) => {
                    const startNode = NODES.find(n => n.id === startId);
                    const endNode = NODES.find(n => n.id === endId);
                    
                    if (!startNode || !endNode) return null;

                    return (
                      <line 
                        key={`${startId}-${endId}`}
                        x1={`${startNode.x}%`} 
                        y1={`${startNode.y}%`} 
                        x2={`${endNode.x}%`} 
                        y2={`${endNode.y}%`} 
                        className="text-indigo-400 opacity-20"
                        stroke="currentColor" 
                        strokeWidth={endNode.isCenter || startNode.isCenter ? 1.5 : 1}
                        strokeDasharray={endNode.isCenter || startNode.isCenter ? "4 4" : ""}
                      />
                    );
                  })}
                </svg>

                {/* 2. Logo/Node Layer */}
                {NODES.map((node, i) => {
                  if (node.isCenter) {
                    return (
                      <div 
                        key={node.id}
                        className="absolute w-24 h-24 sm:w-36 sm:h-36 bg-indigo-600/5 rounded-full border border-indigo-600/10 flex items-center justify-center animate-pulse z-10"
                        style={{ 
                          left: `${node.x}%`, 
                          top: `${node.y}%`, 
                          transform: 'translate(-50%, -50%)' // Center the div on the coordinate
                        }}
                      >
                         <div className="w-12 h-12 sm:w-16 sm:h-16 bg-indigo-600 rounded-[1.5rem] sm:rounded-[2rem] shadow-xl flex items-center justify-center text-white font-black text-xl sm:text-3xl">C</div>
                      </div>
                    );
                  }

                  return (
                    <div 
                      key={node.id}
                      className="absolute z-20"
                      style={{ 
                        left: `${node.x}%`, 
                        top: `${node.y}%`,
                        transform: 'translate(-50%, -50%)', // CRITICAL: Centers the element on the node point
                      }}
                    >
                      <div 
                        className="bg-white p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-xl border border-indigo-100/50 flex items-center justify-center w-12 h-12 sm:w-20 sm:h-20 hover:scale-110 transition-transform duration-300"
                        style={{
                          animation: `float-subtle ${4 + i}s ease-in-out infinite alternate`,
                          animationDelay: `${i * 0.5}s`
                        }}
                      >
                        <img src={node.icon} alt={node.label} className="max-w-[70%] max-h-[70%] object-contain" />
                      </div>
                      
                      {/* Optional Label below */}
                      {/* <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        {node.label}
                      </div> */}
                    </div>
                  );
                })}
             </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float-subtle {
          0% { transform: translateY(0px); }
          100% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
};

export default Hero;
