import React from "react";

const TermsOfService: React.FC = () => {
  const operatorName = process.env.NEXT_PUBLIC_OPERATOR_NAME || "Mgr. Marek Bilek";
  const operatorAddress = process.env.NEXT_PUBLIC_OPERATOR_ADDRESS || "";
  const operatorCompanyId = process.env.NEXT_PUBLIC_OPERATOR_COMPANY_ID || "";
  const operatorVatId = process.env.NEXT_PUBLIC_OPERATOR_VAT_ID || "";
  const operatorDetails = [
    operatorCompanyId ? `Company ID ${operatorCompanyId}` : null,
    operatorVatId ? `VAT ${operatorVatId}` : null,
    operatorAddress ? operatorAddress : null,
  ].filter(Boolean) as string[];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Terms</h1>
      <p className="mt-2 text-sm text-slate-600">Rules for using CareersPal.</p>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6 text-sm text-slate-700 leading-relaxed">
        <section>
          <h2 className="text-base font-semibold text-slate-900">1. Agreement</h2>
          <p className="mt-2">
            By using CareersPal you agree to these terms. They are governed by the laws of the Slovak Republic and the EU.
            Platform operated by {operatorName}.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-slate-900">2. Candidates</h2>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>Use the board to find published roles and apply on the employer’s own link.</li>
            <li>Keep your account information accurate.</li>
            <li>We do not run a talent pool or send your profile to employers.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-base font-semibold text-slate-900">3. Employers</h2>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>Include a salary range for every listing.</li>
            <li>Keep listings accurate and include a working apply link.</li>
            <li>Listings are reviewed before they go live.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-base font-semibold text-slate-900">4. Fees</h2>
          <p className="mt-2">
            The first Standard listing per employer is free (Start pack). After that: Standard $79 / 30 days,
            Featured Pro $149, Elite Managed $249 (USD). Paid listings go through Stripe.
          </p>
          <p className="mt-2">
            If we cannot publish after review, contact info@careerspal.com. Refunds are handled case-by-case.
          </p>
          <p className="mt-2">
            Paused, closed, or archived listings can be renewed at the Standard price within 90 days. After that they
            are removed. Renewal goes to review, then 30 days live if published.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-slate-900">5. Liability</h2>
          <p className="mt-2">
            CareersPal is a job board. We review listings before publish. We do not guarantee hiring outcomes or working
            conditions.
          </p>
        </section>
        <div className="pt-4 border-t border-slate-100 text-xs text-slate-500">
          <p>{operatorName} · info@careerspal.com</p>
          <p className="mt-1">
            {operatorDetails.length > 0
              ? operatorDetails.join(" · ")
              : "Operator details provided on invoice or available on request."}
          </p>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
