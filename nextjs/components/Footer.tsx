import Link from 'next/link';

const Footer = () => {
  return (
    <footer className="bg-white border-t border-slate-200/60 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="mb-12 rounded-[3rem] border border-slate-200/60 bg-white/80 backdrop-blur p-8 md:p-12 shadow-[0_25px_70px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Elite access</p>
              <h3 className="text-2xl md:text-3xl font-black text-slate-900 mt-3">
                Build with teams who respect systems and salary transparency.
              </h3>
              <p className="text-slate-500 font-medium mt-3 max-w-2xl">
                Invite-only roles, verified employers, and response SLAs that protect your time.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/jobs" className="px-8 py-4 rounded-2xl bg-indigo-600 text-white font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">
                Browse roles
              </Link>
              <Link href="/post-a-job" className="px-8 py-4 rounded-2xl bg-white text-slate-900 border border-slate-200 font-black hover:border-indigo-200 hover:text-indigo-600 transition-all">
                Post a job
              </Link>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-black text-lg">C</span>
              </div>
              <div>
                <div className="text-lg font-black text-slate-900 leading-none">CareersPal</div>
                <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Elite Board</div>
              </div>
            </div>
            <p className="text-sm text-slate-500 font-medium">
              Curated roles for modern operations, product, and automation talent.
            </p>
          </div>

          <div>
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-4">Jobs</h4>
            <ul className="space-y-3 text-sm font-bold text-slate-600">
              <li><Link href="/jobs" className="hover:text-indigo-600">Browse Jobs</Link></li>
              <li><Link href="/post-a-job" className="hover:text-indigo-600">Post a Job</Link></li>
              <li><Link href="/salary-insights" className="hover:text-indigo-600">Salary Insights</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-4">Company</h4>
            <ul className="space-y-3 text-sm font-bold text-slate-600">
              <li><Link href="/about" className="hover:text-indigo-600">About</Link></li>
              <li><Link href="/pricing" className="hover:text-indigo-600">Pricing</Link></li>
              <li><Link href="/hire-talent" className="hover:text-indigo-600">Hire Talent</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-4">Legal</h4>
            <ul className="space-y-3 text-sm font-bold text-slate-600">
              <li><Link href="/privacy" className="hover:text-indigo-600">Privacy</Link></li>
              <li><Link href="/terms" className="hover:text-indigo-600">Terms</Link></li>
              <li><Link href="/accessibility" className="hover:text-indigo-600">Accessibility</Link></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 mt-10 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
            © 2026 CareersPal Elite. All rights reserved.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center md:justify-end gap-2 sm:gap-4 text-xs text-slate-400 font-medium text-center md:text-left">
            <span className="leading-relaxed">Built for teams who value clarity, speed, and quality.</span>
            <span className="hidden md:inline text-slate-300">•</span>
            <Link href="/privacy" className="text-slate-400 hover:text-indigo-600 font-bold uppercase tracking-widest text-[10px]">
              Privacy
            </Link>
            <span className="hidden md:inline text-slate-300">•</span>
            <a href="mailto:support@careerspal.com" className="text-slate-400 hover:text-indigo-600 font-bold uppercase tracking-widest text-[10px]">
              Support
            </a>
            <span className="hidden md:inline text-slate-300">•</span>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-700">
              System: Operational
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[9px] font-black uppercase tracking-widest text-slate-400">
              v0.1.0
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
