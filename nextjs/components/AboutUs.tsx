import React from "react";
import Link from "next/link";

const AboutUs: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">About</p>
      <h1 className="mt-2 text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">
        A small board for Ops and Systems work.
      </h1>
      <p className="mt-4 text-[16px] text-slate-700 leading-relaxed">
        CareersPal lists Operations, Systems, Automation, RevOps, Product Ops, and Chief of Staff roles — remote, hybrid, and onsite.
        You search, open a role, and apply on the employer’s own page.
      </p>

      <div className="mt-8 space-y-6">
        <section>
          <h2 className="text-lg font-semibold text-slate-900">For people looking</h2>
          <ul className="mt-3 space-y-2 text-[15px] text-slate-700">
            <li>The live board is open. Search, filter, and apply on the employer’s own page.</li>
            <li>A free account can save one search and get a weekly email. The email uses category, salary floor, and tools stored on the role. Daily delivery and more saved searches are on Premium.</li>
            <li>Pay is shown when the posting states it. We don’t invent ranges.</li>
            <li>Each role page stays open. You apply on the employer’s own page.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-slate-900">For people hiring</h2>
          <ul className="mt-3 space-y-2 text-[15px] text-slate-700">
            <li>Post → review → live. Salary and a working apply link are required.</li>
            <li>The listing sits on the public board. Candidates apply on your link. First Standard listing is free, then $79 / $149 / $249 (USD).</li>
            <li>We do not run a talent pool, intros, or candidate screening.</li>
          </ul>
        </section>
      </div>

      <div className="mt-10 flex flex-col sm:flex-row gap-3">
        <Link
          href="/jobs"
          className="h-12 px-6 rounded-lg bg-indigo-600 text-white text-sm font-semibold inline-flex items-center justify-center hover:bg-indigo-700"
        >
          Browse jobs
        </Link>
        <Link
          href="/hire-talent"
          className="h-12 px-6 rounded-lg border border-slate-200 text-slate-900 text-sm font-semibold inline-flex items-center justify-center hover:bg-slate-50"
        >
          For employers
        </Link>
      </div>
    </div>
  );
};

export default AboutUs;
