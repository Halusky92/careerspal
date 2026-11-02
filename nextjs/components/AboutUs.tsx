
import React from 'react';

const AboutUs: React.FC = () => {
  return (
    <div className="relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-15%] w-[70%] h-[70%] bg-indigo-300/20 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-violet-400/20 rounded-full blur-[140px]"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8 relative z-10">
        <section className="text-center space-y-3">
          <div className="inline-flex items-center space-x-2 bg-white border border-indigo-100 px-3 py-1 rounded-full">
            <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wide">Our philosophy</span>
          </div>
          <h1 className="text-2xl md:text-4xl font-semibold text-slate-900 tracking-tight">
            Curation works. Quality over noise.
          </h1>
          <p className="text-sm md:text-base text-slate-500 max-w-2xl mx-auto">
            A focused remote job board for Ops, Systems, Automation, RevOps, Product Ops, and Chief of Staff. Listings need a salary range and a clear apply link.
          </p>
        </section>

          {/* Metrics (grounded) */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { label: "Curated roles", value: "Live board", note: "Updated continuously" },
            { label: "Review", value: "Before publish", note: "Clarity + salary-first" },
            { label: "Apply", value: "Direct links", note: "Official apply URLs" },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-white/90 backdrop-blur border border-slate-200/60 rounded-[2rem] p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]"
            >
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{item.label}</p>
              <div className="mt-4 text-3xl sm:text-4xl font-black text-slate-900">{item.value}</div>
              <p className="mt-2 text-xs font-bold text-slate-400 uppercase tracking-widest">{item.note}</p>
            </div>
          ))}
        </section>

      {/* Pillars of Trust */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {[
          { 
            title: "Salary Transparency", 
            desc: "We push for clear salary ranges and scope. If a listing lacks key details, it may not be published as-is.", 
            icon: "💎" 
          },
          { 
            title: "Review before publish", 
            desc: "Listings are reviewed for clarity and relevance before they go live on the board.", 
            icon: "🛠️" 
          },
          { 
            title: "Safety & Trust", 
            desc: "We remove obvious spam and keep the board focused. Always verify details on the employer’s official application page.", 
            icon: "🛡️" 
          },
          { 
            title: "Systems Ecosystem", 
            desc: "We aren't for everyone. We are the home for those who love Notion, Make, Zapier, and Slack. We understand the stack you use.", 
            icon: "🧠" 
          }
        ].map(pillar => (
          <div key={pillar.title} className="bg-white p-4 rounded-xl border border-slate-200">
            <div className="text-2xl mb-3 inline-flex bg-slate-50 w-10 h-10 items-center justify-center rounded-lg">{pillar.icon}</div>
            <h3 className="text-xl font-black text-slate-900 mb-4">{pillar.title}</h3>
            <p className="text-slate-500 font-medium leading-relaxed text-sm">{pillar.desc}</p>
          </div>
        ))}
      </div>

      <section className="bg-white p-5 rounded-xl border border-slate-200">
        <h3 className="text-2xl font-black text-slate-900">What this board is</h3>
        <ul className="mt-6 space-y-3 text-slate-600 font-medium">
          <li>Reviewed listings with salary and a working apply link.</li>
          <li>A narrow niche — not a general job board.</li>
          <li>No talent marketplace, no hiring SLA, no fake metrics.</li>
        </ul>
      </section>

      {/* The Mission Statement */}
      <section className="bg-slate-900 rounded-2xl p-6 md:p-8 text-white relative overflow-hidden">
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight leading-tight">
              Why are we here? <br />
              <span className="text-indigo-400">Because systems compound results.</span>
            </h2>
            <div className="space-y-6 text-lg text-slate-400 font-medium leading-relaxed">
              <p>
                Traditional job boards are noisy. Companies look for &quot;Operations&quot;, but they actually need Notion Architects who build the company on Notion.
              </p>
              <p>
                CareersPal is a focused board. We aim to keep it scan-friendly and salary-first.
              </p>
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[3rem] p-10 space-y-8">
            <h4 className="text-xs font-black uppercase tracking-[0.3em] text-indigo-400">What to expect</h4>
            <ul className="space-y-4">
              {[
                "Salary-first listings and clear scope.",
                "Canonical job pages that are easy to share and index.",
                "Category and company pages for browsing."
              ].map(item => (
                <li key={item} className="flex items-start gap-4 text-slate-300 font-bold text-sm">
                  <span className="text-indigo-500 mt-1">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-[100px]"></div>
      </section>

        {/* Leadership Note */}
        <section className="text-center py-6">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-4xl font-black">C</span>
          </div>
          <h3 className="text-3xl font-black text-slate-900 mb-4 tracking-tighter italic">
            &quot;Less noise. More signal.&quot;
          </h3>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">CareersPal</p>
        </section>

        {/* Premium CTA */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 text-center">
          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Get started</p>
          <h4 className="text-3xl md:text-4xl font-black text-slate-900 mt-3">Browse salary-first roles.</h4>
          <p className="text-slate-500 font-medium mt-3">Your next role should feel intentional, not accidental.</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/jobs"
              className="px-8 py-4 rounded-2xl bg-indigo-600 text-white font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all"
            >
              Browse roles
            </a>
            <a
              href="/post-a-job"
              className="px-8 py-4 rounded-2xl bg-white text-slate-900 border border-slate-200 font-black hover:border-indigo-200 hover:text-indigo-600 transition-all"
            >
              Post a job
            </a>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AboutUs;
