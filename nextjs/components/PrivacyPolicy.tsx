import React from "react";

const PrivacyPolicy: React.FC = () => {
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
      <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Privacy</h1>
      <p className="mt-2 text-sm text-slate-600">How we handle your data.</p>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-6 text-sm text-slate-700 leading-relaxed">
        <section>
          <h2 className="text-base font-semibold text-slate-900">1. Controller</h2>
          <p className="mt-2">
            {operatorName} is the data controller. Contact{" "}
            <a href="mailto:info@careerspal.com" className="text-indigo-700 hover:underline">
              info@careerspal.com
            </a>
            .
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {operatorDetails.length > 0
              ? operatorDetails.join(" · ")
              : "Operator details: provided on invoice or available on request."}
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-slate-900">2. What we collect</h2>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>Account name, email, and role (candidate or employer).</li>
            <li>Document links you save in your account. We do not send them to employers.</li>
            <li>Employer company details, billing email, and listings. Paid listings are charged in USD via Stripe.</li>
            <li>Technical data needed to run the site (session, IP, basic usage).</li>
          </ul>
        </section>
        <section>
          <h2 className="text-base font-semibold text-slate-900">3. Why</h2>
          <p className="mt-2">
            To run accounts, listings, and alerts; let candidates apply on the employer’s link; send alerts you asked
            for; and keep the platform secure.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-slate-900">4. Legal basis</h2>
          <p className="mt-2">
            Consent (alerts), contract (job posts and employer tools), and legitimate interest (security and basic
            analytics).
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-slate-900">5. Retention</h2>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>Account profile: while active; deleted on request or after long inactivity.</li>
            <li>Listings: while live, then archived as needed for operations.</li>
            <li>Payment records: as required by accounting rules (typically up to 7 years).</li>
          </ul>
        </section>
        <section>
          <h2 className="text-base font-semibold text-slate-900">6. Processors</h2>
          <p className="mt-2">Supabase (data/auth), Vercel (hosting), Stripe (payments), Resend (email), Google (sign-in if used).</p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-slate-900">7. Your rights</h2>
          <p className="mt-2">
            You can ask to access, correct, delete, or export your data. Email{" "}
            <a href="mailto:info@careerspal.com" className="text-indigo-700 hover:underline">
              info@careerspal.com
            </a>{" "}
            from the address on your account. We aim to complete requests within 30 days.
          </p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
