
import React, { useState } from 'react';
import { generateJobDescription } from '../services/geminiService';
import { PlanType } from '../App';
import { CATEGORIES } from '../constants';

interface PostJobProps {
  onComplete: (data: any) => void;
  selectedPlan: { type: PlanType; price: number };
  onUpgradePlan: (type: PlanType, price: number) => void;
}

const PostJob: React.FC<PostJobProps> = ({ onComplete, selectedPlan, onUpgradePlan }) => {
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    keywords: '',
    description: '',
    company: '',
    companyWebsite: '',
    logo: '', // Changed initial state to empty string
    salary: '$100k - $140k',
    location: 'Remote (Global)',
    type: 'Full-time' as const,
    remotePolicy: 'Global Remote',
    category: 'Operations',
    applyUrl: '',
    tags: ['Notion', 'Remote']
  });

  const handleAI = async () => {
    if (!formData.title) return alert("Please enter a job title first.");
    setIsGenerating(true);
    try {
      const desc = await generateJobDescription(formData.title, formData.keywords);
      setFormData(prev => ({ ...prev, description: desc || '' }));
    } catch (e) {
      alert("AI generation is currently unavailable.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStep1 = () => {
    if (!formData.title || !formData.description) return alert("Please fill in the Job Title and Description.");
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStep2 = () => {
    if (!formData.company || !formData.applyUrl) return alert("Please fill in the Company Name and Apply URL.");
    setStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFinalSubmit = () => {
    // Logic: Use provided logo, otherwise fall back to a random seed or placeholder
    const finalLogo = formData.logo.trim() 
      ? formData.logo 
      : `https://picsum.photos/seed/${formData.company.replace(/\s/g, '')}/100/100`;

    const finalJob = { 
      ...formData, 
      logo: finalLogo,
      postedAt: 'Just now', 
      id: `local-${Date.now()}`,
      isFeatured: selectedPlan.type !== 'Standard'
    };
    onComplete(finalJob);
  };

  // Filter out 'All Roles' for the dropdown
  const categoryOptions = CATEGORIES.filter(c => c !== 'All Roles');

  // Preview Image Helper
  const previewLogo = formData.logo.trim() || `https://picsum.photos/seed/${formData.company ? formData.company.replace(/\s/g, '') : 'random'}/100/100`;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8">
          <div className="mb-10 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-2">Selected Package: {selectedPlan.type} (${selectedPlan.price} / 30 days)</div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">Post a Role.</h1>
            </div>
            <div className="flex gap-2">
              {[1, 2, 3].map(s => (
                <div key={s} className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold transition-all ${step === s ? 'bg-indigo-600 text-white shadow-lg' : step > s ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                  {s}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-50 overflow-hidden">
            {step === 1 && (
              <div className="p-8 sm:p-10 space-y-8">
                <h2 className="text-2xl font-bold flex items-center gap-3">1. Job Details</h2>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Job Title *</label>
                    <input type="text" placeholder="e.g. Senior Notion Architect" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</label>
                      <select className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                        {categoryOptions.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Job Type</label>
                      <select className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}>
                        <option>Full-time</option>
                        <option>Contract</option>
                        <option>Part-time</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Job Description *</label>
                      <button onClick={handleAI} disabled={isGenerating} className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">
                        {isGenerating ? 'AI Writing...' : 'Draft with AI'}
                      </button>
                    </div>
                    <textarea rows={8} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-medium" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                  </div>
                </div>
                <button onClick={handleStep1} className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl hover:bg-indigo-700 transition-all text-lg shadow-xl shadow-indigo-100">Next Step</button>
              </div>
            )}

            {step === 2 && (
              <div className="p-8 sm:p-10 space-y-8">
                <h2 className="text-2xl font-bold flex items-center gap-3">2. Company & Apply</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Company Name *</label>
                    <input type="text" placeholder="Your Company Name" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold" value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Salary Range</label>
                    <input type="text" placeholder="e.g. $80k - $120k" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold" value={formData.salary} onChange={e => setFormData({...formData, salary: e.target.value})} />
                  </div>
                </div>
                
                {/* Optional Logo Input */}
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Company Logo URL (Optional)</label>
                   <div className="flex gap-4 items-center">
                      <input 
                        type="url" 
                        placeholder="https://company.com/logo.png" 
                        className="flex-1 px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-medium text-sm" 
                        value={formData.logo} 
                        onChange={e => setFormData({...formData, logo: e.target.value})} 
                      />
                      <div className="w-12 h-12 bg-white border border-slate-100 rounded-xl p-1 flex-shrink-0 flex items-center justify-center">
                         <img src={previewLogo} className="max-w-full max-h-full object-contain" alt="Preview" />
                      </div>
                   </div>
                   <p className="text-[9px] text-slate-400 font-bold">Leave empty to auto-generate a placeholder.</p>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">How to Apply? (URL or Email) *</label>
                  <input type="text" placeholder="https://company.com/careers or jobs@company.com" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold" value={formData.applyUrl} onChange={e => setFormData({...formData, applyUrl: e.target.value})} />
                </div>
                <div className="flex gap-4 pt-6">
                  <button onClick={() => setStep(1)} className="px-8 py-5 bg-slate-100 text-slate-500 font-black rounded-2xl">Back</button>
                  <button onClick={handleStep2} className="flex-1 bg-indigo-600 text-white font-black py-5 rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100">Review Listing</button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="p-8 sm:p-10 text-center space-y-10">
                <div className="bg-emerald-50 text-emerald-700 px-6 py-3 rounded-2xl border border-emerald-100 inline-block font-black text-xs uppercase tracking-widest">Ready to Launch</div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight">Final Preview</h2>
                <div className="bg-slate-50 p-8 rounded-[2.5rem] text-left border border-slate-100">
                   <div className="flex items-center gap-6 mb-6">
                      <div className="w-16 h-16 bg-white rounded-xl border flex items-center justify-center p-2">
                         <img src={previewLogo} alt="" className="max-h-full max-w-full object-contain" />
                      </div>
                      <div>
                        <h4 className="text-2xl font-black text-slate-900 leading-none mb-1">{formData.title}</h4>
                        <p className="text-indigo-600 font-bold uppercase text-xs tracking-widest">{formData.company}</p>
                      </div>
                   </div>
                   <div className="text-slate-500 line-clamp-4 text-sm font-medium leading-relaxed">{formData.description}</div>
                   <div className="mt-6 flex gap-3">
                      <span className="bg-white border border-slate-100 px-3 py-1 rounded-lg text-[10px] font-black text-slate-400 uppercase">{formData.type}</span>
                      <span className="bg-white border border-slate-100 px-3 py-1 rounded-lg text-[10px] font-black text-slate-400 uppercase">{formData.salary}</span>
                   </div>
                </div>
                <div className="flex flex-col gap-4">
                  <button onClick={handleFinalSubmit} className="w-full bg-slate-900 text-white font-black py-6 rounded-2xl hover:bg-black shadow-2xl active:scale-[0.98] transition-all text-xl">
                    Proceed to Payment (${selectedPlan.price})
                  </button>
                  <button onClick={() => setStep(2)} className="text-slate-400 font-bold hover:text-indigo-600 transition-colors">Edit details</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
           <div className="bg-indigo-50 p-8 rounded-[2.5rem] border border-indigo-100">
              <h3 className="text-xl font-black text-indigo-900 mb-4">Post Tips.</h3>
              <ul className="space-y-4 text-sm font-medium text-indigo-700/80 leading-relaxed">
                 <li className="flex gap-3"><span className="text-indigo-500">⚡</span> Be specific about your Notion workspace setup.</li>
                 <li className="flex gap-3"><span className="text-indigo-500">⚡</span> Mention automation tools like Zapier or Make.</li>
                 <li className="flex gap-3"><span className="text-indigo-500">⚡</span> Transparency with salary attracts 3x more talent.</li>
              </ul>
           </div>
           
           <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm relative z-20">
              <h3 className="text-lg font-black text-slate-900 mb-2">Selected Plan</h3>
              <div className="text-3xl font-black text-indigo-600 mb-4">
                ${selectedPlan.price}
                <span className="text-lg text-slate-400 font-bold"> / 30 days</span>
              </div>
              <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">{selectedPlan.type}</div>
              
              {/* Plan Upgrade Options */}
              {selectedPlan.type === 'Standard' && (
                <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-2xl p-6 text-white text-center shadow-lg relative group/tooltip">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-xs font-black uppercase tracking-widest opacity-80 text-left">Boost Visibility</p>
                    <div className="relative">
                      <div className="w-5 h-5 rounded-full border border-white/40 flex items-center justify-center text-[10px] font-bold cursor-help hover:bg-white hover:text-indigo-600 transition-colors">?</div>
                      {/* Tooltip */}
                      <div className="absolute right-0 bottom-full mb-2 w-64 bg-white text-slate-900 p-4 rounded-xl shadow-2xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-300 pointer-events-none z-50 transform translate-y-2 group-hover/tooltip:translate-y-0 text-left border border-slate-100">
                        <div className="text-xs font-black uppercase tracking-widest text-indigo-600 mb-3">Featured Pro Benefits</div>
                        <ul className="space-y-2">
                           <li className="flex items-start gap-2 text-[11px] font-bold text-slate-600 leading-tight">
                              <span className="text-indigo-600 mt-0.5">✓</span> 7 Days at Top of Board
                           </li>
                           <li className="flex items-start gap-2 text-[11px] font-bold text-slate-600 leading-tight">
                              <span className="text-indigo-600 mt-0.5">✓</span> Newsletter Feature
                           </li>
                           <li className="flex items-start gap-2 text-[11px] font-bold text-slate-600 leading-tight">
                              <span className="text-indigo-600 mt-0.5">✓</span> Social Media Blast
                           </li>
                           <li className="flex items-start gap-2 text-[11px] font-bold text-slate-600 leading-tight">
                              <span className="text-indigo-600 mt-0.5">✓</span> Verified Badge
                           </li>
                        </ul>
                        <div className="absolute -bottom-2 right-1.5 w-4 h-4 bg-white transform rotate-45 border-r border-b border-slate-100"></div>
                      </div>
                    </div>
                  </div>
                  <p className="font-bold text-sm mb-4 text-left">Get 3x more applicants with a Featured listing.</p>
                  <button 
                    onClick={() => onUpgradePlan('Featured Pro', 149)}
                    className="w-full bg-white text-indigo-800 py-3 rounded-xl font-black text-sm hover:bg-indigo-50 transition-colors"
                  >
                    Upgrade to Pro (+$70)
                  </button>
                </div>
              )}
              
              {selectedPlan.type === 'Featured Pro' && (
                <div className="bg-slate-900 rounded-2xl p-6 text-white text-center shadow-lg relative group/tooltip">
                   <div className="flex justify-between items-start mb-2">
                     <p className="text-xs font-black uppercase tracking-widest opacity-80 text-left">Go Elite</p>
                     <div className="relative">
                      <div className="w-5 h-5 rounded-full border border-white/40 flex items-center justify-center text-[10px] font-bold cursor-help hover:bg-white hover:text-slate-900 transition-colors">?</div>
                      {/* Tooltip */}
                      <div className="absolute right-0 bottom-full mb-2 w-64 bg-white text-slate-900 p-4 rounded-xl shadow-2xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-300 pointer-events-none z-50 transform translate-y-2 group-hover/tooltip:translate-y-0 text-left border border-slate-100">
                        <div className="text-xs font-black uppercase tracking-widest text-indigo-600 mb-3">Elite Managed Benefits</div>
                        <ul className="space-y-2">
                           <li className="flex items-start gap-2 text-[11px] font-bold text-slate-600 leading-tight">
                              <span className="text-indigo-600 mt-0.5">💎</span> Permanent Top-of-Board placement
                           </li>
                           <li className="flex items-start gap-2 text-[11px] font-bold text-slate-600 leading-tight">
                              <span className="text-indigo-600 mt-0.5">💎</span> 3 Curated Candidate Intros
                           </li>
                           <li className="flex items-start gap-2 text-[11px] font-bold text-slate-600 leading-tight">
                              <span className="text-indigo-600 mt-0.5">💎</span> Dedicated Slack Announcement
                           </li>
                           <li className="flex items-start gap-2 text-[11px] font-bold text-slate-600 leading-tight">
                              <span className="text-indigo-600 mt-0.5">💎</span> Portfolio Review
                           </li>
                        </ul>
                        <div className="absolute -bottom-2 right-1.5 w-4 h-4 bg-white transform rotate-45 border-r border-b border-slate-100"></div>
                      </div>
                    </div>
                   </div>
                   <p className="font-bold text-sm mb-4 text-left">Let us hand-pick candidates for you.</p>
                   <button 
                    onClick={() => onUpgradePlan('Elite Managed', 249)}
                    className="w-full bg-white text-slate-900 py-3 rounded-xl font-black text-sm hover:bg-slate-200 transition-colors"
                   >
                     Upgrade to Elite (+$100)
                   </button>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default PostJob;
