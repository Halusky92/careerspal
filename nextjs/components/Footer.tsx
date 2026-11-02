"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const Footer = () => {
  const pathname = usePathname();
  if (pathname?.startsWith("/account") || pathname?.startsWith("/auth") || pathname?.startsWith("/dashboard")) {
    return null;
  }

  return (
    <footer className="bg-white border-t border-slate-200 mt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-slate-700">
            Ops and Systems roles. Search, save, apply on the company site.
          </p>
          <div className="flex gap-2">
            <Link href="/jobs" className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium inline-flex items-center">
              Browse jobs
            </Link>
            <Link href="/hire-talent" className="h-9 px-4 rounded-lg bg-white border border-slate-200 text-slate-800 text-sm font-medium inline-flex items-center">
              For employers
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
          <div className="col-span-2 md:col-span-1 space-y-2">
            <div className="font-semibold text-slate-900">CareersPal</div>
            <p className="text-slate-600">Ops, Systems, Automation, RevOps, Product Ops, Chief of Staff. Remote, hybrid, and onsite.</p>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Jobs</h4>
            <ul className="space-y-1.5 text-slate-600">
              <li><Link href="/jobs" className="hover:text-indigo-600">Browse jobs</Link></li>
              <li><Link href="/companies" className="hover:text-indigo-600">Companies</Link></li>
              <li><Link href="/alerts" className="hover:text-indigo-600">Email alerts</Link></li>
              <li><Link href="/salary-insights" className="hover:text-indigo-600">Salary ranges</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Employers</h4>
            <ul className="space-y-1.5 text-slate-600">
              <li><Link href="/hire-talent" className="hover:text-indigo-600">Post a job</Link></li>
              <li><Link href="/pricing" className="hover:text-indigo-600">Pricing</Link></li>
              <li><Link href="/about" className="hover:text-indigo-600">About</Link></li>
              <li><a href="mailto:info@careerspal.com" className="hover:text-indigo-600">Support</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Legal</h4>
            <ul className="space-y-1.5 text-slate-600">
              <li><Link href="/privacy" className="hover:text-indigo-600">Privacy</Link></li>
              <li><Link href="/terms" className="hover:text-indigo-600">Terms</Link></li>
              <li><Link href="/accessibility" className="hover:text-indigo-600">Accessibility</Link></li>
            </ul>
          </div>
        </div>
        <div className="pt-5 mt-6 border-t border-slate-100 text-xs text-slate-500">
          © 2026 CareersPal. Independent platform, not affiliated with similarly named entities.{" "}
          <a href="mailto:info@careerspal.com" className="text-slate-700 hover:text-indigo-600">info@careerspal.com</a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
