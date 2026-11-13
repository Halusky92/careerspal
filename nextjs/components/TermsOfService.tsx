import React from "react";
import { publicOperator } from "../lib/operator";

const TermsOfService: React.FC = () => {
  const operator = publicOperator();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Terms</h1>
      <p className="mt-2 text-sm text-slate-600">Rules for using CareersPal.</p>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6 text-sm text-slate-700 leading-relaxed">
        <section>
          <h2 className="text-base font-semibold text-slate-900">1. Agreement</h2>
          <p className="mt-2">
            By using CareersPal you agree to these terms. They are governed by the laws of the Slovak Republic and the EU.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-slate-900">2. Operator</h2>
          <p className="mt-2">
            CareersPal is operated by {operator.name}, a natural person in the {operator.country}. Contact{" "}
            <a href={`mailto:${operator.email}`} className="text-indigo-700 hover:underline">
              {operator.email}
            </a>
            .
          </p>
          {operator.lines.length > 0 ? <p className="mt-1 text-xs text-slate-500">{operator.lines.join(" · ")}</p> : null}
        </section>
        <section>
          <h2 className="text-base font-semibold text-slate-900">3. Candidates</h2>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>Use the board to find published roles and apply on the employer’s own link.</li>
            <li>Keep your account information accurate.</li>
            <li>We do not run a talent pool or send your profile to employers.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-base font-semibold text-slate-900">4. Employers</h2>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>Include a salary range for every listing.</li>
            <li>Keep listings accurate and include a working apply link.</li>
            <li>Listings are reviewed before they go live. That is not a timed SLA.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-base font-semibold text-slate-900">5. Fees and billing</h2>
          <p className="mt-2">
            The first Standard listing per employer is free (Start pack). After that: Standard $79 / 30 days,
            Featured Pro $149, Elite Managed $249 (USD). Paid listings go through Stripe. Stripe emails the receipt
            for that payment.
          </p>
          <p className="mt-2">
            Paused, closed, or archived listings can be renewed at the Standard price within 90 days. After that they
            are removed. Renewal goes to review, then 30 days live if published.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-slate-900">6. Refunds</h2>
          <p className="mt-2">
            If a paid listing is not published after review, we refund the Stripe charge. Email {operator.email} from
            the paying account. If the listing went live, the fee is for that 30-day placement and is not refunded when
            you pause or close it.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-slate-900">7. Liability</h2>
          <p className="mt-2">
            CareersPal is a job board. We review listings before publish. We do not guarantee hiring outcomes or working
            conditions.
          </p>
        </section>
        <div className="pt-4 border-t border-slate-100 text-xs text-slate-500">
          <p>
            {operator.name} · {operator.country} · {operator.email}
          </p>
          {operator.lines.length > 0 ? <p className="mt-1">{operator.lines.join(" · ")}</p> : null}
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
