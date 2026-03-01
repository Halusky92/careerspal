"use client";


import React, { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSupabaseAuth } from "./Providers";

const Navbar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const pathname = usePathname();
  const { profile, signOut } = useSupabaseAuth();

  const dashboardHref = useMemo(() => {
    if (!profile?.email) return null;
    if (profile.role === "admin") return "/dashboard/admin";
    if (profile.role === "employer") return "/dashboard/employer";
    return "/dashboard/candidate";
  }, [profile]);

  // Prevent scrolling when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isMenuOpen]);

  useEffect(() => {
    setIsMenuOpen(false);
    setIsOverflowOpen(false);
  }, [pathname]);

  const overflowItems = [
    { label: "Salary Insights", href: "/salary-insights" },
    { label: "About", href: "/about" },
    { label: "Subscribe", href: "/#subscribe" },
  ];

  const navItems = [
    { label: 'Jobs', href: '/jobs' },
    { label: 'Pricing', href: '/pricing' },
  ];

  const handleMobileNav = () => {
    setIsMenuOpen(false);
  };

  return (
    <>
      <nav className="sticky top-0 z-[100] bg-white/80 backdrop-blur-xl border-b border-gray-100 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20 items-center">
            {/* Logo */}
            <Link
              href="/"
              scroll
              onClick={(event) => {
                // When already on home, Next.js won't navigate.
                // Make the logo behave like "scroll to top".
                if (pathname === "/") {
                  event.preventDefault();
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
              className="flex items-center space-x-3 cursor-pointer group relative z-[102]"
            >
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center transition-transform group-hover:rotate-6 shadow-xl shadow-indigo-100">
                <span className="text-white font-bold text-lg">C</span>
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold tracking-tight text-indigo-600 leading-none">CareersPal</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-700 mt-1">Elite Ecosystem</span>
              </div>
            </Link>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-6">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={pathname === item.href ? "page" : undefined}
                  className={`text-sm font-bold tracking-tight transition-colors ${
                    pathname === item.href ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </Link>
              ))}

              {dashboardHref && (
                <Link href={dashboardHref} className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors">
                  Dashboard
                </Link>
              )}

              {!profile?.email && (
                <Link href="/auth" className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors">
                  Sign in
                </Link>
              )}

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsOverflowOpen((prev) => !prev)}
                  className="h-9 w-9 rounded-full border border-slate-200 bg-white text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-colors flex items-center justify-center"
                  aria-haspopup="menu"
                  aria-expanded={isOverflowOpen}
                  aria-label="More options"
                >
                  <span className="text-lg leading-none">⋯</span>
                </button>
                {isOverflowOpen && (
                  <div className="absolute right-0 mt-3 w-48 rounded-2xl border border-slate-200 bg-white shadow-xl p-2 text-sm text-slate-600">
                    {overflowItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="block rounded-xl px-3 py-2 font-bold hover:bg-slate-50 hover:text-slate-900"
                      >
                        {item.label}
                      </Link>
                    ))}
                    {profile?.email && (
                      <>
                        <Link
                          href="/account"
                          className="block rounded-xl px-3 py-2 font-bold hover:bg-slate-50 hover:text-slate-900"
                        >
                          Account
                        </Link>
                        <button
                          onClick={() => signOut()}
                          className="w-full text-left rounded-xl px-3 py-2 font-bold hover:bg-slate-50 hover:text-slate-900"
                        >
                          Log out
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {profile?.role === "employer" || profile?.role === "admin" ? (
                <Link href="/post-a-job" className="bg-indigo-600 text-white px-6 py-2.5 rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95">
                  Post a Job
                </Link>
              ) : (
                <Link href="/hire-talent" className="bg-indigo-600 text-white px-6 py-2.5 rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-95">
                  Hire Talent
                </Link>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden relative z-[102] flex items-center gap-2">
              {(profile?.role === "employer" || profile?.role === "admin") ? (
                <Link
                  href="/post-a-job"
                  className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-semibold uppercase tracking-wide shadow-lg shadow-indigo-200"
                >
                  Post a Job
                </Link>
              ) : (
                <Link
                  href="/hire-talent"
                  className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-semibold uppercase tracking-wide shadow-lg shadow-indigo-200"
                >
                  Hire Talent
                </Link>
              )}
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)} 
                className="p-2 text-slate-800 focus:outline-none"
                aria-label="Toggle menu"
                aria-expanded={isMenuOpen}
                aria-controls="mobile-menu"
              >
                <div className="w-5 h-4 relative flex flex-col justify-between">
                  <span className={`w-full h-0.5 bg-slate-800 rounded-full transition-all duration-300 origin-left ${isMenuOpen ? 'rotate-45 translate-x-1' : ''}`}></span>
                  <span className={`w-full h-0.5 bg-slate-800 rounded-full transition-all duration-300 ${isMenuOpen ? 'opacity-0 scale-0' : 'opacity-100 scale-100'}`}></span>
                  <span className={`w-full h-0.5 bg-slate-800 rounded-full transition-all duration-300 origin-left ${isMenuOpen ? '-rotate-45 translate-x-1' : ''}`}></span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Quick Nav */}
        <div className="md:hidden border-t border-slate-100">
          <div className="px-4 sm:px-6 py-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-widest transition-colors ${
                    pathname === item.href
                      ? "bg-indigo-600 text-white shadow-md"
                      : "bg-white text-slate-500 border border-slate-100"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              {dashboardHref && (
                <Link
                  href={dashboardHref}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-widest transition-colors ${
                    pathname?.startsWith("/dashboard")
                      ? "bg-indigo-600 text-white shadow-md"
                      : "bg-white text-slate-500 border border-slate-100"
                  }`}
                >
                  Dashboard
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <div
        id="mobile-menu"
        className={`fixed inset-0 z-[101] bg-white md:hidden transition-all duration-500 flex flex-col ${isMenuOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full pointer-events-none'}`}
      >
        <div className="flex-1 flex flex-col px-6 pb-8 overflow-y-auto">
          <div className="pt-6 pb-4 flex items-center justify-between border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
                <span className="text-white font-black text-sm">C</span>
              </div>
              <div>
                <div className="text-sm font-black text-slate-900">CareersPal</div>
                <div className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">Mobile Menu</div>
              </div>
            </div>
            <button
              onClick={handleMobileNav}
              className="w-10 h-10 rounded-full border border-slate-100 flex items-center justify-center text-slate-500 hover:text-indigo-600"
              aria-label="Close menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {!profile?.email && (
            <div className="pt-4">
              <Link
                href="/auth"
                onClick={handleMobileNav}
                className="w-full py-4 rounded-2xl bg-slate-50 text-slate-900 font-black text-base border border-slate-100 active:scale-95 transition-transform text-center"
              >
                Sign In / Sign Up
              </Link>
            </div>
          )}

          <div className="mt-4 rounded-[2rem] border border-emerald-200 bg-emerald-50/60 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-700">Verified board</p>
            <p className="mt-2 text-sm font-bold text-slate-700">
              Invite-only roles, salary transparency, and SLA-backed responses.
            </p>
          </div>

          <div className="py-6">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-3">Navigation</p>
            <div className="flex flex-col">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleMobileNav}
                aria-current={pathname === item.href ? "page" : undefined}
                className={`w-full text-left text-xl font-black tracking-tight py-4 px-2 border-b border-slate-100 transition-colors ${
                  pathname === item.href ? 'text-indigo-600' : 'text-slate-900'
                }`}
              >
                {item.label}
              </Link>
            ))}
              <Link
                href="/#subscribe"
                onClick={handleMobileNav}
                className="w-full text-left text-xl font-black tracking-tight py-4 px-2 border-b border-slate-100 transition-colors text-slate-900"
              >
                Subscribe
              </Link>
            </div>
          </div>

          <div className="mt-auto space-y-3 pt-4 border-t border-slate-100">
             <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Account</p>
             {dashboardHref && (
               <Link
                 href={dashboardHref}
                 onClick={handleMobileNav}
                 className="w-full py-4 text-slate-900 font-black text-base border border-slate-100 active:scale-95 transition-transform text-center"
               >
                 Dashboard
               </Link>
             )}

            {profile?.email && (
              <Link
                href="/account"
                onClick={handleMobileNav}
                className="w-full py-4 text-slate-900 font-black text-base border border-slate-100 active:scale-95 transition-transform text-center"
              >
                Account
              </Link>
            )}

             {profile?.email && (
               <button
                 onClick={() => {
                   handleMobileNav();
                   signOut();
                 }}
                className="w-full py-4 bg-slate-50 text-slate-900 font-black text-base border border-slate-100 active:scale-95 transition-transform text-center"
               >
                 Log out
               </button>
             )}

             <Link
               href={profile?.role === "employer" || profile?.role === "admin" ? "/post-a-job" : "/hire-talent"}
               onClick={handleMobileNav}
               className="w-full py-5 bg-indigo-600 text-white font-black text-lg shadow-2xl shadow-indigo-200 active:scale-95 transition-transform flex items-center justify-center gap-3"
             >
               <span>{profile?.role === "employer" || profile?.role === "admin" ? "Post a Job" : "Hire Talent"}</span>
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
             </Link>
             
             <p className="text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 pt-6">
                CareersPal Elite Mobile
             </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;
