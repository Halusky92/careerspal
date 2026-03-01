
import React from 'react';

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
    <div className="max-w-4xl mx-auto px-6 py-24 animate-in fade-in slide-in-from-bottom-4">
      <div className="mb-12">
        <h1 className="text-5xl font-bold text-slate-900 mb-4 tracking-tighter">Privacy Policy</h1>
        <p className="text-xl text-slate-500 font-medium italic">Your data security is the foundation of our elite network.</p>
      </div>

      <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl shadow-indigo-100 border border-indigo-50 space-y-12">
        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">1. Data Controller</h2>
          </div>
          <p className="text-slate-600 leading-relaxed font-medium">
            The data controller responsible for your personal information is <strong>{operatorName}</strong>. We process data in accordance with the GDPR and other local data protection laws.
            <br /><br />
            <strong>Contact:</strong> <a href="mailto:info@careerspal.com" className="text-indigo-600 font-semibold hover:underline">info@careerspal.com</a>
            <br />
            <span className="text-xs text-slate-600 font-medium uppercase tracking-wide">
              {operatorDetails.length > 0
                ? `Operator details: ${operatorDetails.join(" • ")}`
                : "Operator details: provided on invoice or available on request."}
            </span>
          </p>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">2. Information We Collect</h2>
          </div>
          <div className="space-y-4 text-slate-600 font-medium">
            <p>We collect and process the following categories of data:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Profile Information:</strong> Name, email, professional role, and Notion/system expertise.</li>
              <li><strong>Professional Credentials:</strong> Resumes, portfolios (Notion sites), and work history provided for the Talent Pool.</li>
              <li><strong>Employer Data:</strong> Company details, VAT numbers (for billing), and job descriptions.</li>
              <li><strong>Technical Data:</strong> IP address, browser type, and usage patterns via essential cookies.</li>
            </ul>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">3. Purpose of Processing</h2>
          </div>
          <p className="text-slate-600 leading-relaxed font-medium">
            We process your data exclusively to:
            <br />
            - Connect elite Notion architects with high-growth companies.
            <br />
            - Facilitate job applications and talent matching.
            <br />
            - Send curated newsletters and platform updates (only with consent).
            <br />
            - Prevent fraud and maintain a secure ecosystem.
          </p>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">4. Legal Basis</h2>
          </div>
          <p className="text-slate-600 leading-relaxed font-medium">
            We process personal data based on consent (newsletter, alerts), legitimate interest (platform security, analytics, product improvement), and contract performance (job postings, employer tools, candidate services).
          </p>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">5. Data Retention</h2>
          </div>
          <div className="text-slate-600 leading-relaxed font-medium space-y-4">
            <p>
              We keep personal data only as long as necessary for the purpose it was collected for, and longer where we have legal obligations (e.g., accounting).
            </p>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">Retention overview (typical)</p>
              <ul className="mt-3 list-disc pl-5 space-y-2 text-sm">
                <li><strong>Account profile</strong>: while your account is active; deleted upon request or after prolonged inactivity (typically up to 24 months), unless we must retain certain records.</li>
                <li><strong>Candidate profile / CV / portfolio links</strong>: while you keep the profile active; deleted upon request (we may retain minimal audit/security logs).</li>
                <li><strong>Employer job listings</strong>: while live + archived history for operational recordkeeping (typically up to 24 months), unless deletion is requested and not required by law.</li>
                <li><strong>Payment records</strong>: retained for legal/financial compliance (typically up to 7 years, depending on jurisdiction).</li>
                <li><strong>Email delivery logs</strong>: typically up to 12 months for deliverability, abuse prevention, and troubleshooting.</li>
                <li><strong>Security/audit logs</strong>: typically up to 12–24 months (fraud prevention, incident response).</li>
              </ul>
            </div>
            <p className="text-xs text-slate-500">
              Exact retention may vary based on legal requirements and the nature of your request (e.g., disputes, fraud prevention).
            </p>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 7h18M6 7v10a2 2 0 002 2h8a2 2 0 002-2V7" /></svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">6. Processors & Data Transfers</h2>
          </div>
          <div className="text-slate-600 leading-relaxed font-medium space-y-4">
            <p>
              We use vetted service providers (“processors”) to run the platform. Where applicable, they act under a Data Processing Agreement (DPA) and contractual safeguards (e.g., Standard Contractual Clauses for cross‑border transfers).
            </p>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">Main subprocessors</p>
              <ul className="mt-3 list-disc pl-5 space-y-2 text-sm">
                <li><strong>Supabase</strong> — database, storage, authentication.</li>
                <li><strong>Vercel</strong> — hosting, CDN, serverless compute.</li>
                <li><strong>Stripe</strong> — payments and invoicing.</li>
                <li><strong>Resend</strong> — transactional and alert emails.</li>
                <li><strong>Google</strong> — OAuth sign‑in (if you use Google login) and AI features (Gemini) when explicitly triggered.</li>
              </ul>
            </div>
            <p className="text-xs text-slate-500">
              Some providers may process data outside the EEA/UK. We rely on appropriate safeguards and contractual controls to protect your data.
            </p>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">7. Cookies & Analytics</h2>
          </div>
          <p className="text-slate-600 leading-relaxed font-medium">
            We use essential cookies to maintain sessions and security. We also collect basic analytics for site performance. You can disable non-essential cookies in your browser.
          </p>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" /></svg>
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">8. Your Rights</h2>
          </div>
          <div className="text-slate-600 leading-relaxed font-medium space-y-4">
            <p>
              You have the right to access, correct, delete, or export your personal data, and to object or restrict certain processing (subject to legal limitations).
            </p>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">DSR process (access / delete / export)</p>
              <ol className="mt-3 list-decimal pl-5 space-y-2 text-sm">
                <li>Email your request to <a href="mailto:info@careerspal.com" className="text-indigo-600 font-black hover:underline">info@careerspal.com</a> from the address linked to your account.</li>
                <li>We may ask for additional verification to protect your data.</li>
                <li><strong>Acknowledgement SLA:</strong> typically within <strong>2 days</strong>.</li>
                <li><strong>Completion target:</strong> we aim to complete requests within <strong>30 days</strong> (GDPR standard), or sooner where possible.</li>
              </ol>
            </div>
          </div>
        </section>

        <div className="pt-10 border-t border-slate-50 flex justify-between items-center">
          <p className="text-xs font-black text-slate-300 uppercase tracking-widest">© 2026 CareersPal Elite • Mgr. Marek Bilek</p>
          <div className="flex gap-4">
            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center"><span className="text-indigo-600 text-[10px] font-black">GDPR</span></div>
            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center"><span className="text-indigo-600 text-[10px] font-black">SSL</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
