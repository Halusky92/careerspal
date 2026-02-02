
import React from 'react';

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-6 py-24 animate-in fade-in slide-in-from-bottom-4">
      <div className="mb-12">
        <h1 className="text-5xl font-black text-slate-900 mb-4 tracking-tighter">Privacy Policy</h1>
        <p className="text-xl text-slate-500 font-medium italic">Your data security is the foundation of our elite network.</p>
      </div>

      <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl shadow-indigo-100 border border-indigo-50 space-y-12">
        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">1. Data Controller</h2>
          </div>
          <p className="text-slate-600 leading-relaxed font-medium">
            The data controller responsible for your personal information is <strong>Mgr. Marek Bilek</strong> (CEO & Founder of CareersPal Elite). We process data in accordance with the GDPR and other local data protection laws.
            <br /><br />
            <strong>Contact:</strong> <a href="mailto:info@careerspal.com" className="text-indigo-600 font-bold hover:underline">info@careerspal.com</a>
          </p>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">2. Information We Collect</h2>
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
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">3. Purpose of Processing</h2>
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
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">4. Your Rights</h2>
          </div>
          <p className="text-slate-600 leading-relaxed font-medium">
            You have the right to access, correct, or delete your personal data at any time. You can also object to processing or request data portability. To exercise these rights, please contact us at the email above.
          </p>
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
