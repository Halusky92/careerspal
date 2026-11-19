import React from "react";
import Link from "next/link";
import { BOARD_PREMIUM_PRICE } from "../lib/boardAccess";
import { PLAN_PRICES } from "../lib/plans";

const AboutUs: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">About</p>
      <h1 className="mt-2 text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">
        A board for Ops and Systems work.
      </h1>
      <p className="mt-4 text-[16px] text-slate-700 leading-relaxed">
        CareersPal is a small board for Operations, Systems, Automation, RevOps, Product Ops, and Chief of Staff.
        The roles are remote and hybrid. The aim is a short list you can actually read: the pay the employer wrote,
        a clear scope, and an apply link that opens on their page.
      </p>
      <p className="mt-3 text-[16px] text-slate-700 leading-relaxed">
        A listing is checked before it is published. That check covers the salary, the scope, and a working apply link.
        It is not a promise that the role is still open, or that the company will reply.
      </p>

      <div className="mt-8 space-y-8">
        <section>
          <h2 className="text-lg font-semibold text-slate-900">What you can do here</h2>
          <ul className="mt-3 space-y-2.5 text-[15px] text-slate-700 leading-relaxed">
            <li>Search the live board and filter by category, salary, region, work mode, and tools.</li>
            <li>Open a role and apply on the employer’s own page. A public role does not need an account.</li>
            <li>Read the pay when the posting states it. Ranges are not filled in when the employer left them out.</li>
            <li>
              See pay on the board as the midpoint of the USD listings in each category. It is what is on this board, not a market survey.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">If you want the email</h2>
          <p className="mt-3 text-[15px] text-slate-700 leading-relaxed">
            The email uses the category, salary floor, and tools you choose.
          </p>
          <ul className="mt-3 space-y-2.5 text-[15px] text-slate-700 leading-relaxed">
            <li>No account is required. That email goes out Tuesday and Friday, after a role is public.</li>
            <li>A free account saves one of those searches and uses the same Tuesday and Friday email.</li>
            <li>
              Premium is ${BOARD_PREMIUM_PRICE} a month. It sends that search after each search, lets you save more than one, and includes roles in their first 24 hours.
            </li>
          </ul>
          <p className="mt-3 text-[15px] text-slate-700 leading-relaxed">
            A new role stays with Premium for 24 hours, then its page is public.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-slate-900">If you are hiring</h2>
          <p className="mt-3 text-[15px] text-slate-700 leading-relaxed">
            Post a role with a salary and a working apply link. After review it is on Premium for 24 hours, then on the public board.
            Candidates apply on your link.
          </p>
          <ul className="mt-3 space-y-2.5 text-[15px] text-slate-700 leading-relaxed">
            <li>
              The first Standard listing per company and account is free, then Standard ${PLAN_PRICES.standard} or Featured Pro ${PLAN_PRICES.pro} for 30 days.
            </li>
            <li>Featured Pro stays in the featured zone above the list for those 30 days, with a Pro label.</li>
            <li>On the listing you can see views, apply clicks, and where they came from.</li>
          </ul>
          <p className="mt-3 text-[15px] text-slate-700 leading-relaxed">
            CareersPal does not run a talent pool, make introductions, or screen candidates.
          </p>
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
          href="/alerts"
          className="h-12 px-6 rounded-lg border border-slate-200 text-slate-900 text-sm font-semibold inline-flex items-center justify-center hover:bg-slate-50"
        >
          Email alerts
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
