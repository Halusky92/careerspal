"use client";


import React, { useMemo, useState } from 'react';
import { generateJobDescription } from '../services/geminiService';
import { Job, PlanType } from '../types';
import { CATEGORIES, CATEGORY_FILTER_LABELS } from '../constants';
import { PLAN_PRICES } from '../lib/plans';
import StartPackMeter from "./StartPackMeter";
import type { StartPackStatus } from "../lib/founding";

interface PostJobProps {
  onComplete: (data: Job) => void;
  selectedPlan: { type: PlanType; price: number };
  onUpgradePlan: (type: PlanType, price: number) => void;
  showTestPlan?: boolean;
  foundingEligible?: boolean;
  foundingStatus?: StartPackStatus | null;
  initialJob?: Partial<Job>;
}

type JobFormData = Omit<Job, 'id' | 'postedAt' | 'isFeatured' | 'planType' | 'plan' | 'timestamp' | 'status' | 'views' | 'matches'>;

const PostJob: React.FC<PostJobProps> = ({ onComplete, selectedPlan, onUpgradePlan, showTestPlan, foundingEligible, foundingStatus, initialJob }) => {
  const [step, setStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [logoFileName, setLogoFileName] = useState<string>("");
  const [openInfoId, setOpenInfoId] = useState<("get" | "requirements" | "review") | null>("get");
  const formatPrice = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

  const steps = [
    { id: 1, title: "Role details", desc: "Title, scope, salary" },
    { id: 2, title: "Company & apply", desc: "Brand + link" },
    { id: 3, title: "Preview & pay", desc: foundingEligible ? "Start pack — submit for review" : "Confirm & checkout" },
  ] as const;

  
  const [formData, setFormData] = useState<JobFormData>({
    title: initialJob?.title || '',
    keywords: initialJob?.keywords || '',
    description: initialJob?.description || '',
    company: initialJob?.company || '',
    companyWebsite: initialJob?.companyWebsite || '',
    logo: initialJob?.logo || '',
    salary: initialJob?.salary || '',
    location: initialJob?.location || 'Remote (Global)',
    type: (initialJob?.type as JobFormData['type']) || 'Full-time',
    remotePolicy: initialJob?.remotePolicy || 'Global Remote',
    category: initialJob?.category || 'Operations',
    applyUrl: initialJob?.applyUrl || '',
    tags: initialJob?.tags?.length ? initialJob.tags : []
  });

  const planHighlights = useMemo(() => {
    const base = [
      "Listing reviewed before publish",
      "30 days live on the board",
      "Included in search + filters",
      "Support via info@careerspal.com",
    ];
    if (selectedPlan.type === "Featured Pro") {
      return [
        ...base,
        "Featured zone on the board",
        "Pro badge on the listing",
      ];
    }
    if (selectedPlan.type === "Elite Managed") {
      return [
        ...base,
        "First in the featured zone",
        "Elite badge on the listing",
      ];
    }
    return base;
  }, [selectedPlan.type]);

  const AccordionRow = ({
    id,
    title,
    children,
  }: {
    id: "get" | "requirements" | "review";
    title: string;
    children: React.ReactNode;
  }) => {
    const isOpen = openInfoId === id;
    return (
      <div className="rounded-2xl border border-slate-200/60 bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => setOpenInfoId((prev) => (prev === id ? null : id))}
          className="w-full px-3 py-2.5 flex items-center justify-between gap-3 text-left"
          aria-expanded={isOpen}
        >
          <span className="text-sm font-black text-slate-900">{title}</span>
          <span className="text-slate-400 font-black">{isOpen ? "−" : "+"}</span>
        </button>
        {isOpen && <div className="px-3 pb-3">{children}</div>}
      </div>
    );
  };

  const handleAI = async () => {
    if (!formData.title) return alert("Please enter a job title first.");
    setIsGenerating(true);
    try {
      const desc = await generateJobDescription(formData.title, formData.keywords ?? '');
      setFormData(prev => ({ ...prev, description: desc || '' }));
    } catch (e) {
      alert("AI generation is currently unavailable.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStep1 = () => {
    if (!formData.title || !formData.description || !formData.salary) {
      return alert("Please fill in the Job Title, Description, and Salary.");
    }
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const normalizeHttpUrl = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return trimmed;
    if (trimmed.startsWith("data:")) return trimmed;
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
    if (trimmed.includes(".") && !trimmed.includes(" ")) return `https://${trimmed}`;
    return trimmed;
  };

  const normalizeApplyUrl = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return trimmed;
    if (trimmed === "#" || trimmed.startsWith("/") || trimmed.startsWith("mailto:")) return trimmed;
    if (trimmed.includes("@") && !trimmed.includes(":")) return `mailto:${trimmed}`;
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
    if (trimmed.includes(".") && !trimmed.includes(" ")) return `https://${trimmed}`;
    return trimmed;
  };

  const handleStep2 = () => {
    if (!formData.company || !formData.applyUrl) return alert("Please fill in the Company Name and Apply URL.");
    setStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFinalSubmit = () => {
    // Logic: Use provided logo, otherwise fall back to a random seed or placeholder
    const finalLogo = formData.logo.trim()
      ? normalizeHttpUrl(formData.logo)
      : `https://picsum.photos/seed/${formData.company.replace(/\s/g, '')}/100/100`;
    const keywordTags = formData.keywords
      ? formData.keywords
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      : [];
    const mergedTags = Array.from(new Set([...(formData.tags || []), ...keywordTags]));
    const normalizedApplyUrl = normalizeApplyUrl(formData.applyUrl);
    const normalizedCompanyWebsite = normalizeHttpUrl(formData.companyWebsite || "");

    const finalJob: Job = { 
      ...formData,
      tags: mergedTags,
      applyUrl: normalizedApplyUrl,
      logo: finalLogo,
      companyWebsite: normalizedCompanyWebsite || undefined,
      postedAt: 'Just now', 
      id: `local-${Date.now()}`,
      isFeatured: selectedPlan.type !== 'Standard'
    };
    onComplete(finalJob);
  };

  // Filter out 'All Roles' for the dropdown
  const categoryOptions = CATEGORIES.filter(c => c !== 'All Roles');

  // Preview Image Helper
  const previewLogo = formData.logo.trim()
    ? (formData.logo.startsWith("http://") || formData.logo.startsWith("https://") || formData.logo.startsWith("data:")
        ? formData.logo
        : `https://${formData.logo}`)
    : `https://picsum.photos/seed/${formData.company ? formData.company.replace(/\s/g, '') : 'random'}/100/100`;

  const handleLogoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setLogoFileName("");
      return;
    }
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file.");
      setLogoFileName("");
      return;
    }
    setLogoFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (result) {
        setFormData(prev => ({ ...prev, logo: result }));
      }
    };
    reader.readAsDataURL(file);
  };

  const usingStartPack = Boolean(foundingEligible && selectedPlan.type === "Standard");

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3">
      {foundingStatus?.enabled && (
        <div className="mb-4">
          <StartPackMeter status={foundingStatus} pendingUse={usingStartPack} />
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8">
          <div className="mb-3">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-2">
                  Selected Package: {selectedPlan.type} ({formatPrice(selectedPlan.price)} / 30 days)
                </div>
                <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">Post a role</h1>
              </div>

              <div className="sm:hidden">
                <div className="inline-flex items-center gap-2 rounded-2xl bg-white border border-slate-200/70 px-3 py-2 shadow-sm">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Step</span>
                  <span className="text-[10px] font-black text-indigo-700">{step} / {steps.length}</span>
                </div>
              </div>
            </div>

            <div className="mt-3 hidden sm:flex items-center gap-2">
              {steps.map((s) => {
                const isActive = step === s.id;
                const isDone = step > s.id;
                return (
                  <div key={s.id} className="flex items-center gap-2 min-w-0">
                    <span
                      className={[
                        "h-6 w-6 rounded-md flex items-center justify-center text-[11px] font-semibold",
                        isActive ? "bg-indigo-600 text-white" : isDone ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-400",
                      ].join(" ")}
                      aria-current={isActive ? "step" : undefined}
                    >
                      {isDone ? "✓" : s.id}
                    </span>
                    <span className={["text-xs font-medium truncate", isActive ? "text-slate-900" : "text-slate-500"].join(" ")}>
                      {s.title}
                    </span>
                    {s.id !== steps.length && <span className="text-slate-300 px-1">/</span>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {step === 1 && (
              <div className="p-4 space-y-3">
                <h2 className="text-sm font-semibold tracking-tight">1. Job details</h2>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Job Title *</label>
                    <input type="text" placeholder="e.g. Senior Notion Architect" className="cp-field w-full h-10 rounded-lg px-3 text-sm outline-none" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Keywords</label>
                    <input
                      type="text"
                      placeholder="Notion, Zapier, Ops, Automation"
                      className="cp-field w-full h-10 rounded-lg px-3 text-sm outline-none"
                      value={formData.keywords}
                      onChange={e => setFormData({...formData, keywords: e.target.value})}
                    />
                    <p className="text-[9px] text-slate-400 font-bold">Used to improve AI drafting and search relevance.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</label>
                      <select className="cp-field w-full h-10 rounded-lg px-3 text-sm outline-none" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                        {categoryOptions.map(cat => (
                          <option key={cat} value={cat}>{CATEGORY_FILTER_LABELS[cat] || cat}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Job Type</label>
                      <select className="cp-field w-full h-10 rounded-lg px-3 text-sm outline-none" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as Job['type']})}>
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
                    <textarea rows={5} className="cp-field w-full rounded-lg px-3 py-2.5 text-sm outline-none" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                  </div>
                </div>
                <button onClick={handleStep1} className="w-full h-10 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">Next</button>
              </div>
            )}

            {step === 2 && (
              <div className="p-4 space-y-3">
                <h2 className="text-sm font-semibold tracking-tight">2. Company & apply</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Company Name *</label>
                    <input type="text" placeholder="Your Company Name" className="cp-field w-full h-10 rounded-lg px-3 text-sm outline-none" value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Salary Range</label>
                    <input type="text" placeholder="e.g. $80k - $120k" className="cp-field w-full h-10 rounded-lg px-3 text-sm outline-none" value={formData.salary} onChange={e => setFormData({...formData, salary: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-700">Work mode</label>
                    <select
                      className="cp-field w-full h-10 rounded-lg px-3 text-sm outline-none"
                      value={formData.remotePolicy}
                      onChange={e => setFormData({...formData, remotePolicy: e.target.value})}
                    >
                      <option>Remote (Global)</option>
                      <option>Remote (Regional)</option>
                      <option>Hybrid</option>
                      <option>Onsite</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-700">Region / time zone (optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Worldwide, Europe, US, CET±2"
                      className="cp-field w-full h-10 rounded-lg px-3 text-sm outline-none"
                      value={formData.location}
                      onChange={e => setFormData({...formData, location: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Company Website</label>
                  <input
                    type="text"
                    inputMode="url"
                    placeholder="company.com"
                    className="cp-field w-full h-10 rounded-lg px-3 text-sm outline-none"
                    value={formData.companyWebsite}
                    onChange={e => setFormData({...formData, companyWebsite: e.target.value})}
                    onBlur={() =>
                      setFormData((prev) => ({
                        ...prev,
                        companyWebsite: prev.companyWebsite ? normalizeHttpUrl(prev.companyWebsite) : prev.companyWebsite,
                      }))
                    }
                  />
                </div>
                
                {/* Optional Logo Input */}
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Company Logo (Optional)</label>
                   <div className="flex gap-4 items-center">
                      <input 
                        type="url" 
                        placeholder="https://company.com/logo.png (optional)" 
                        className="cp-field flex-1 h-10 rounded-lg px-3 text-sm outline-none" 
                        value={formData.logo.startsWith("data:") ? "" : formData.logo} 
                        onChange={e => setFormData({...formData, logo: e.target.value})}
                        onBlur={() =>
                          setFormData((prev) => ({
                            ...prev,
                            logo: prev.logo && !prev.logo.startsWith("data:") ? normalizeHttpUrl(prev.logo) : prev.logo,
                          }))
                        }
                      />
                      <div className="w-12 h-12 bg-white border border-slate-100 rounded-xl p-1 flex-shrink-0 flex items-center justify-center">
                         <img src={previewLogo} className="max-w-full max-h-full object-contain" alt="Preview" />
                      </div>
                   </div>
                   <div className="flex flex-wrap items-center gap-3">
                     <input
                       id="cp-logo-upload"
                       type="file"
                       accept="image/*"
                       onChange={handleLogoFileChange}
                       className="sr-only"
                     />
                     <label
                       htmlFor="cp-logo-upload"
                       className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:border-indigo-200 hover:text-indigo-600 cursor-pointer"
                     >
                       Upload from computer
                     </label>
                     {logoFileName && (
                       <span className="text-[10px] font-bold text-slate-400 truncate max-w-[220px]" title={logoFileName}>
                         {logoFileName}
                       </span>
                     )}
                     {formData.logo && (
                       <button
                         type="button"
                         onClick={() => setFormData(prev => ({ ...prev, logo: "" }))}
                         className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600"
                       >
                         Remove logo
                       </button>
                     )}
                   </div>
                   <p className="text-[9px] text-slate-400 font-bold">
                     Paste a logo URL or upload from your computer (PNG/JPG/SVG).
                   </p>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">How to Apply? (URL or Email) *</label>
                  <input
                    type="text"
                    inputMode="url"
                    placeholder="company.com/careers or jobs@company.com"
                    className="cp-field w-full h-10 rounded-lg px-3 text-sm outline-none"
                    value={formData.applyUrl}
                    onChange={e => setFormData({...formData, applyUrl: e.target.value})}
                    onBlur={() =>
                      setFormData((prev) => ({
                        ...prev,
                        applyUrl: prev.applyUrl ? normalizeApplyUrl(prev.applyUrl) : prev.applyUrl,
                      }))
                    }
                  />
                  <p className="text-[9px] text-slate-400 font-bold">Auto-formats after you leave the field.</p>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setStep(1)} className="h-10 px-4 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50">Back</button>
                  <button onClick={handleStep2} className="flex-1 h-10 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">Review listing</button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="p-4 sm:p-5 text-center space-y-3">
                <div className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-100 inline-block text-[11px] font-semibold uppercase tracking-wide">Ready to submit</div>
                <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Preview</h2>
                <div className="bg-slate-50 p-4 sm:p-5 rounded-xl text-left border border-slate-200">
                   <div className="flex items-center gap-3 mb-3">
                      <div className="w-16 h-16 bg-white rounded-xl border flex items-center justify-center p-2">
                         <img src={previewLogo} alt="" className="max-h-full max-w-full object-contain" />
                      </div>
                      <div>
                        <h4 className="text-xl sm:text-2xl font-bold text-slate-900 leading-none mb-1">{formData.title}</h4>
                        <p className="text-indigo-600 font-semibold uppercase text-[10px] sm:text-xs tracking-wide">{formData.company}</p>
                        {formData.companyWebsite && (
                          <p className="text-[10px] font-medium text-slate-600 mt-1">{formData.companyWebsite}</p>
                        )}
                      </div>
                   </div>
                   <div className="text-slate-500 line-clamp-4 text-sm font-medium leading-relaxed">{formData.description}</div>
                   <div className="mt-6 flex gap-3 flex-wrap">
                      <span className="bg-white border border-slate-100 px-3 py-1 rounded-lg text-[10px] font-semibold text-slate-600 uppercase tracking-wide">{formData.type}</span>
                      <span className="bg-white border border-slate-100 px-3 py-1 rounded-lg text-[10px] font-semibold text-slate-600 uppercase tracking-wide">{formData.salary}</span>
                      <span className="bg-white border border-slate-100 px-3 py-1 rounded-lg text-[10px] font-semibold text-slate-600 uppercase tracking-wide">{formData.remotePolicy}</span>
                      <span className="bg-white border border-slate-100 px-3 py-1 rounded-lg text-[10px] font-semibold text-slate-600 uppercase tracking-wide">{formData.location}</span>
                   </div>
                </div>
                <div className="flex flex-col gap-4">
                <button onClick={handleFinalSubmit} className="w-full h-10 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-black">
                    {foundingEligible && selectedPlan.type === "Standard"
                      ? "Submit with Start pack"
                      : `Proceed to Payment (${formatPrice(selectedPlan.price)})`}
                  </button>
                  <button onClick={() => setStep(2)} className="text-slate-600 font-medium hover:text-indigo-600 transition-colors">Edit details</button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-3">
           <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600">For employers</div>
                  <h3 className="text-base font-semibold text-slate-900 mt-1">Post → review → live.</h3>
                  <p className="mt-2 text-sm font-medium text-slate-600">
                    Listing on the board. Candidates apply on your link.
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <AccordionRow id="get" title={`What you get (${selectedPlan.type})`}>
                  <ul className="space-y-2 text-sm font-medium text-slate-700">
                    {planHighlights.map((x) => (
                      <li key={x} className="flex items-start gap-2">
                        <span className="text-emerald-600 font-semibold mt-0.5">✓</span>
                        <span>{x}</span>
                      </li>
                    ))}
                  </ul>
                </AccordionRow>

                <AccordionRow id="requirements" title="Requirements (for approval)">
                  <ul className="space-y-2 text-sm font-medium text-slate-700">
                    <li className="flex items-start gap-2"><span className="text-slate-900 font-semibold mt-0.5">•</span> Salary range included</li>
                    <li className="flex items-start gap-2"><span className="text-slate-900 font-semibold mt-0.5">•</span> Clear scope + responsibilities</li>
                    <li className="flex items-start gap-2"><span className="text-slate-900 font-semibold mt-0.5">•</span> Working apply link (URL or email)</li>
                    <li className="flex items-start gap-2"><span className="text-slate-900 font-semibold mt-0.5">•</span> No spam / vague listings</li>
                  </ul>
                </AccordionRow>

                <AccordionRow id="review" title="Review & publish timeline">
                  <div className="space-y-2 text-sm font-medium text-slate-700">
                    <div className="flex items-start gap-2"><span className="text-indigo-600 font-semibold mt-0.5">1</span> Post{foundingEligible ? " (Start pack: submit, then review)" : " (submit + pay)"}</div>
                    <div className="flex items-start gap-2"><span className="text-indigo-600 font-semibold mt-0.5">2</span> Review — salary, scope, apply link, niche. Not a timed SLA.</div>
                    <div className="flex items-start gap-2"><span className="text-indigo-600 font-semibold mt-0.5">3</span> Live on the board. Apply stays on your link.</div>
                    <p className="mt-3 text-xs text-slate-600">
                      Listings are reviewed before publish. Timing can vary based on completeness and review queue.
                    </p>
                  </div>
                </AccordionRow>
              </div>

              <div className="mt-5 text-xs font-medium text-slate-600">
                Questions or edits? Email <span className="font-semibold text-slate-800">info@careerspal.com</span>.
              </div>
           </div>
           
           <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 relative z-20">
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Selected plan</h3>
              <div className="text-2xl font-semibold text-indigo-600 mb-2">
                {usingStartPack ? "Free" : formatPrice(selectedPlan.price)}
                <span className="text-lg text-slate-600 font-medium"> {usingStartPack ? "Start pack" : "/ 30 days"}</span>
              </div>
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">{selectedPlan.type}</div>
              
              {/* Plan Upgrade Options */}
              {selectedPlan.type === 'Standard' && (
                <div className="bg-indigo-600 rounded-xl p-4 text-white text-center relative group/tooltip">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-xs font-black uppercase tracking-widest opacity-80 text-left">Boost Visibility</p>
                    <div className="relative">
                      <div className="w-5 h-5 rounded-full border border-white/40 flex items-center justify-center text-[10px] font-bold cursor-help hover:bg-white hover:text-indigo-600 transition-colors">?</div>
                      {/* Tooltip */}
                      <div className="absolute right-0 bottom-full mb-2 w-64 bg-white text-slate-900 p-4 rounded-xl shadow-2xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-300 pointer-events-none z-50 transform translate-y-2 group-hover/tooltip:translate-y-0 text-left border border-slate-100">
                        <div className="text-xs font-black uppercase tracking-widest text-indigo-600 mb-3">Featured Pro</div>
                        <ul className="space-y-2">
                           <li className="flex items-start gap-2 text-[11px] font-bold text-slate-600 leading-tight">
                              <span className="text-indigo-600 mt-0.5">✓</span> Featured zone on the board
                           </li>
                           <li className="flex items-start gap-2 text-[11px] font-bold text-slate-600 leading-tight">
                              <span className="text-indigo-600 mt-0.5">✓</span> Prominent placement on the board
                           </li>
                        </ul>
                        <div className="absolute -bottom-2 right-1.5 w-4 h-4 bg-white transform rotate-45 border-r border-b border-slate-100"></div>
                      </div>
                    </div>
                  </div>
                  <p className="font-bold text-sm mb-4 text-left">Puts this listing in the featured zone on the board.</p>
                  <button 
                    onClick={() => onUpgradePlan('Featured Pro', PLAN_PRICES.pro)}
                    className="w-full bg-white text-indigo-800 py-3 rounded-xl font-black text-sm hover:bg-indigo-50 transition-colors"
                  >
                    Upgrade to Pro (+$70)
                  </button>
                </div>
              )}
              
              {selectedPlan.type === 'Featured Pro' && (
                <div className="bg-slate-900 rounded-xl p-4 text-white text-center relative group/tooltip">
                   <div className="flex justify-between items-start mb-2">
                     <p className="text-xs font-black uppercase tracking-widest opacity-80 text-left">Go Elite</p>
                     <div className="relative">
                      <div className="w-5 h-5 rounded-full border border-white/40 flex items-center justify-center text-[10px] font-bold cursor-help hover:bg-white hover:text-slate-900 transition-colors">?</div>
                      {/* Tooltip */}
                      <div className="absolute right-0 bottom-full mb-2 w-64 bg-white text-slate-900 p-4 rounded-xl shadow-2xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-300 pointer-events-none z-50 transform translate-y-2 group-hover/tooltip:translate-y-0 text-left border border-slate-100">
                        <div className="text-xs font-black uppercase tracking-widest text-indigo-600 mb-3">Elite Managed</div>
                        <ul className="space-y-2">
                           <li className="flex items-start gap-2 text-[11px] font-bold text-slate-600 leading-tight">
                              <span className="text-indigo-600 mt-0.5">✓</span> First in the featured zone
                           </li>
                           <li className="flex items-start gap-2 text-[11px] font-bold text-slate-600 leading-tight">
                              <span className="text-indigo-600 mt-0.5">✓</span> Paid placement for 30 days
                           </li>
                        </ul>
                        <div className="absolute -bottom-2 right-1.5 w-4 h-4 bg-white transform rotate-45 border-r border-b border-slate-100"></div>
                      </div>
                    </div>
                   </div>
                   <p className="font-bold text-sm mb-4 text-left">First in the featured zone for 30 days.</p>
                   <button 
                    onClick={() => onUpgradePlan('Elite Managed', PLAN_PRICES.elite)}
                    className="w-full bg-white text-slate-900 py-3 rounded-xl font-black text-sm hover:bg-slate-200 transition-colors"
                   >
                     Upgrade to Elite (+${PLAN_PRICES.elite - PLAN_PRICES.pro})
                   </button>
                </div>
              )}

              {selectedPlan.type !== 'Standard' && (
                <button
                  onClick={() => onUpgradePlan('Standard', PLAN_PRICES.standard)}
                  className="mt-6 w-full px-4 py-3 rounded-xl border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:border-indigo-200 hover:text-indigo-600 transition-colors"
                >
                  Switch to Standard (${PLAN_PRICES.standard})
                </button>
              )}

              {showTestPlan && (
                <div className="mt-6 rounded-2xl border border-emerald-200/60 bg-emerald-50/70 p-5">
                  <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Admin internal plan</div>
                  <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="text-xl font-black text-emerald-900">{formatPrice(1)}</div>
                      <div className="text-[9px] font-bold uppercase tracking-widest text-emerald-600">Email allowlisted</div>
                    </div>
                    <button
                      onClick={() => onUpgradePlan("Standard", 1)}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-colors"
                    >
                      Use $1 plan
                    </button>
                  </div>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default PostJob;
