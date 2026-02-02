
import React from 'react';

const TermsOfService: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-6 py-24 animate-in fade-in slide-in-from-bottom-4">
      <div className="mb-12">
        <h1 className="text-5xl font-black text-slate-900 mb-4 tracking-tighter">Terms & Conditions</h1>
        <p className="text-xl text-slate-500 font-medium italic">Rules for an elite, high-trust marketplace.</p>
      </div>

      <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl shadow-indigo-100 border border-indigo-50 space-y-12">
        <section className="space-y-4">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">1. Agreement to Terms</h2>
          <p className="text-slate-600 leading-relaxed font-medium">
            By accessing or using the CareersPal Elite platform, you agree to be bound by these Terms and Conditions. These terms are governed by the laws of the Slovak Republic and the EU. Platform operated by Mgr. Marek Bilek.
          </p>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">2. User Responsibilities (Architects)</h2>
          <div className="space-y-4 text-slate-600 font-medium">
            <p>As a candidate on our platform, you agree to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide accurate and truthful information regarding your skills and experience.</li>
              <li>Use the platform solely for professional recruitment purposes.</li>
              <li>Respect the confidentiality of employer information shared during the application process.</li>
            </ul>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">3. Employer Responsibilities</h2>
          <div className="space-y-4 text-slate-600 font-medium">
            <p>Employers using CareersPal Elite must:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Include transparent salary ranges for all listings.</li>
              <li>Ensure all job advertisements comply with labor laws and equality standards.</li>
              <li>Provide timely feedback to applicants (the "No-Ghosting" policy).</li>
            </ul>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">4. Fees & Payments</h2>
          <div className="text-slate-600 leading-relaxed font-medium space-y-4">
            <p>
              Job posting fees start at <strong>$79 per 30-day listing</strong> (Standard). We also offer Featured Pro ($149) and Elite Managed ($249) tiers with additional visibility benefits.
            </p>
            <p>
              <strong>Refund Policy:</strong> If your job listing is not published to our board within 24 hours of successful payment submission, you are entitled to a full refund. However, once a listing has been live and active on the platform for more than 7 days, no refunds or cancellations will be issued.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">5. Limitation of Liability</h2>
          <p className="text-slate-600 leading-relaxed font-medium">
            CareersPal Elite is a matchmaking platform. While we curate listings and talent, we do not verify the ultimate performance of candidates or the working conditions of employers. Users interact at their own professional risk.
          </p>
        </section>

        <div className="pt-10 border-t border-slate-50">
          <p className="text-sm font-black text-slate-900 uppercase tracking-widest mb-2">Legal Representative:</p>
          <p className="text-slate-500 font-bold">Mgr. Marek Bilek • CEO & Founder</p>
          <p className="text-slate-500 font-bold">Email: info@careerspal.com</p>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
