import React from "react";

const AccessibilityStatement: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Accessibility</h1>
      <p className="mt-2 text-sm text-slate-600">We work to keep the board usable.</p>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6 text-sm text-slate-700 leading-relaxed">
        <section>
          <h2 className="text-base font-semibold text-slate-900">Commitment</h2>
          <p className="mt-2">
            CareersPal should be usable by people with disabilities. We keep improving the site against WCAG 2.1 AA.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-slate-900">Status</h2>
          <p className="mt-2">
            The site is partially conformant with WCAG 2.1 level AA. Some pages may not fully meet that standard yet.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-slate-900">Feedback</h2>
          <p className="mt-2">
            If something is hard to use, email{" "}
            <a href="mailto:info@careerspal.com" className="text-indigo-700 hover:underline">
              info@careerspal.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
};

export default AccessibilityStatement;
