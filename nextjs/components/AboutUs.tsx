
import React from 'react';

const AboutUs: React.FC = () => {
  return (
    <div className="relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-15%] w-[70%] h-[70%] bg-indigo-300/20 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-violet-400/20 rounded-full blur-[140px]"></div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-24 space-y-24 animate-in fade-in duration-700 relative z-10">
        {/* Hero Section */}
        <section className="text-center space-y-8">
          <div className="inline-flex items-center space-x-2 bg-white/80 backdrop-blur border border-indigo-100 px-4 py-2 rounded-full shadow-sm">
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">Our Philosophy</span>
          </div>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-slate-900 tracking-tight leading-none">
            Curation Works. <br />
            <span className="text-indigo-600 text-gradient">Quality over Noise.</span>
          </h1>
          <p className="text-lg md:text-2xl text-slate-500 max-w-3xl mx-auto font-medium leading-relaxed">
            We are the filter between a chaotic job market and systems-first operators. CareersPal reviews every listing, enforces clarity (salary + scope), and keeps the board high-signal.
          </p>
        </section>

        {/* Premium Metrics */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { label: "Curated roles", value: "Live board", note: "Updated continuously" },
            { label: "Response SLA", value: "2 days", note: "Verified employers" },
            { label: "Matches", value: "Direct apply", note: "Clear links, fast flow" },
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
            desc: "Every role has a clear salary range. We don't believe in 'Competitive salary' without numbers. Elite talent deserves to know their value upfront.", 
            icon: "💎" 
          },
          { 
            title: "Elite Manual Curation", 
            desc: "Our team (and AI) manually approves every listing. No LinkedIn duplicates, no shady agencies. Only direct, verified roles.", 
            icon: "🛠️" 
          },
          { 
            title: "Safety & Trust", 
            desc: "Every employer is vetted. We protect you from 'ghosting' and unprofessionalism. We are your professional shield.", 
            icon: "🛡️" 
          },
          { 
            title: "Systems Ecosystem", 
            desc: "We aren't for everyone. We are the home for those who love Notion, Make, Zapier, and Slack. We understand the stack you use.", 
            icon: "🧠" 
          }
        ].map(pillar => (
          <div key={pillar.title} className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all group">
            <div className="text-5xl mb-8 group-hover:scale-110 transition-transform inline-block bg-slate-50 w-20 h-20 flex items-center justify-center rounded-[1.8rem]">{pillar.icon}</div>
            <h3 className="text-xl font-black text-slate-900 mb-4">{pillar.title}</h3>
            <p className="text-slate-500 font-medium leading-relaxed text-sm">{pillar.desc}</p>
          </div>
        ))}
      </div>

      {/* What we do vs what we don't */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-indigo-50 p-12 rounded-[3.5rem] space-y-8">
          <h3 className="text-2xl font-black text-indigo-900">What we do</h3>
          <ul className="space-y-4">
            {[
              "We verify company expertise in systems.",
              "We enforce responses for candidates.",
              "We support pay equality.",
              "We build a library of workflow templates."
            ].map(t => (
              <li key={t} className="flex items-center gap-4 text-indigo-700 font-bold">
                <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-[10px]">✓</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-slate-50 p-12 rounded-[3.5rem] space-y-8">
          <h3 className="text-2xl font-black text-slate-900">What we never do</h3>
          <ul className="space-y-4">
            {[
              "We never sell your data to third parties.",
              "We don't allow listings without salary.",
              "We don't spam your inbox with noise.",
              "We don't ignore reported unfair behavior."
            ].map(t => (
              <li key={t} className="flex items-center gap-4 text-slate-400 font-bold line-through opacity-70">
                <span className="w-6 h-6 bg-slate-200 text-slate-400 rounded-full flex items-center justify-center text-[10px]">✕</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* The Mission Statement */}
      <section className="bg-slate-900 rounded-[4rem] p-12 md:p-24 text-white relative overflow-hidden">
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">
              Why are we here? <br />
              <span className="text-indigo-400">Because systems compound results.</span>
            </h2>
            <div className="space-y-6 text-lg text-slate-400 font-medium leading-relaxed">
              <p>
                Traditional job boards are noisy. Companies look for &quot;Operations&quot;, but they actually need Notion Architects who build the company on Notion.
              </p>
              <p>
                <strong>CareersPal Elite</strong> is a filter. Where the top 1% of Ops talent meets companies that understand the power of automation.
              </p>
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[3rem] p-10 space-y-8">
            <h4 className="text-xs font-black uppercase tracking-[0.3em] text-indigo-400">Our Talent Promise</h4>
            <ul className="space-y-4">
              {[
                "Response from companies within 2 days, or we step in.",
                "Direct access to founders (C-level).",
                "Premium roles with education budgets.",
                "A community of like-minded architects."
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
        <section className="text-center py-20">
          <div className="w-24 h-24 bg-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-10 shadow-2xl">
            <span className="text-white text-4xl font-black">C</span>
          </div>
          <h3 className="text-3xl font-black text-slate-900 mb-4 tracking-tighter italic">&quot;We will change the way the world builds companies.&quot;</h3>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Mgr. Marek Bilek • CEO & Founder of CareersPal Elite</p>
        </section>

        {/* Premium CTA */}
        <section className="bg-white/80 backdrop-blur border border-slate-200/60 rounded-[3rem] p-10 md:p-16 text-center shadow-[0_25px_70px_rgba(15,23,42,0.08)]">
          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Join the elite</p>
          <h4 className="text-3xl md:text-4xl font-black text-slate-900 mt-3">Build with verified teams who value systems.</h4>
          <p className="text-slate-500 font-medium mt-3">Your next role should feel intentional, not accidental.</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/jobs"
              className="px-8 py-4 rounded-2xl bg-indigo-600 text-white font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all"
            >
              Browse roles
            </a>
            <a
              href="/hire-talent"
              className="px-8 py-4 rounded-2xl bg-white text-slate-900 border border-slate-200 font-black hover:border-indigo-200 hover:text-indigo-600 transition-all"
            >
              Hire premium talent
            </a>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AboutUs;
