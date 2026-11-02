import React from "react";
import Link from "next/link";

const AboutUs: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">About</p>
      <h1 className="mt-2 text-3xl sm:text-4xl font-semibold text-slate-900 tracking-tight">
        A small board for Ops and Systems work.
      </h1>
      <p className="mt-4 text-[16px] text-slate-700 leading-relaxed">
        CareersPal lists remote roles in Operations, Systems, Automation, RevOps, Product Ops, and Chief of Staff.
        You search, open a role, and apply on the employer’s own page.
      </p>

      <div className="mt-8 space-y-6">
        <section>
          <h2 className="text-lg font-semibold text-slate-900">For people looking</h2>
          <ul className="mt-3 space-y-2 text-[15px] text-slate-700">
            <li>Browse or search the live board.</li>
            <li>Save roles and get an email when a new one in your category is published.</li>
            <li>Pay is shown on the listing when the employer provided it — we don’t invent ranges.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-slate-900">For people hiring</h2>
          <ul className="mt-3 space-y-2 text-[15px] text-slate-700">
            <li>Post with a salary range and a working apply link.</li>
            <li>Listings are reviewed before they go live. That is not a timed SLA.</li>
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
