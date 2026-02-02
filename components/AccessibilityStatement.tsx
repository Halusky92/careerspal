
import React from 'react';

const AccessibilityStatement: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-6 py-24 animate-in fade-in slide-in-from-bottom-4">
      <div className="mb-12">
        <h1 className="text-5xl font-black text-slate-900 mb-4 tracking-tighter">Accessibility Statement</h1>
        <p className="text-xl text-slate-500 font-medium italic">Commitment to an inclusive ecosystem.</p>
      </div>

      <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl shadow-indigo-100 border border-indigo-50 space-y-10">
        <section className="space-y-4">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Our Commitment</h2>
          <p className="text-slate-600 leading-relaxed font-medium">
            At CareersPal Elite, we believe that the future of remote work—specifically within the Notion and Operations ecosystem—should be accessible to everyone. We are committed to ensuring digital accessibility for people with disabilities. We are continually improving the user experience for everyone and applying the relevant accessibility standards.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Conformance Status</h2>
          <p className="text-slate-600 leading-relaxed font-medium">
            The Web Content Accessibility Guidelines (WCAG) defines requirements for designers and developers to improve accessibility for people with disabilities. CareersPal Elite is partially conformant with WCAG 2.1 level AA. Partially conformant means that some parts of the content do not fully conform to the accessibility standard.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Feedback</h2>
          <p className="text-slate-600 leading-relaxed font-medium">
            We welcome your feedback on the accessibility of CareersPal Elite. Please let us know if you encounter accessibility barriers:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-slate-600 font-medium">
            <li>Email: <a href="mailto:info@careerspal.com" className="text-indigo-600 font-bold hover:underline">info@careerspal.com</a></li>
            <li>Attention: Mgr. Marek Bilek (CEO & Founder)</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Technical Specifications</h2>
          <p className="text-slate-600 leading-relaxed font-medium">
            Accessibility of CareersPal Elite relies on the following technologies to work with the particular combination of web browser and any assistive technologies or plugins installed on your computer:
          </p>
          <div className="flex flex-wrap gap-2">
            {['HTML', 'WAI-ARIA', 'CSS', 'JavaScript'].map(tech => (
              <span key={tech} className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest border border-indigo-100">{tech}</span>
            ))}
          </div>
        </section>

        <div className="pt-10 border-t border-slate-50">
          <p className="text-xs font-black text-slate-300 uppercase tracking-widest">Last Updated: March 2026</p>
        </div>
      </div>
    </div>
  );
};

export default AccessibilityStatement;
