"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSupabaseAuth } from "./Providers";
import BrandMark from "./BrandMark";

const AccountIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-700" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
    <circle cx="12" cy="8" r="3.2" />
    <path d="M5.5 19c1.4-3 3.6-4.5 6.5-4.5s5.1 1.5 6.5 4.5" strokeLinecap="round" />
  </svg>
);

const Navbar: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const pathname = usePathname();
  const { profile, signOut } = useSupabaseAuth();
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? "hidden" : "unset";
  }, [isMenuOpen]);

  useEffect(() => {
    setIsMenuOpen(false);
    setIsAccountOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) {
        setIsAccountOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const closeMobile = () => setIsMenuOpen(false);
  const isEmployer = profile?.role === "employer" || profile?.role === "admin";
  const hireHref = isEmployer ? "/post-a-job" : "/hire-talent";
  const hireLabel = isEmployer ? "Post a job" : "Employers";

  const accountLinks = [
    { label: "Profile", href: "/account" },
    { label: "Saved jobs", href: "/account?tab=saved" },
    { label: "Alerts", href: "/account?tab=alerts" },
    { label: "Settings", href: "/account?tab=settings" },
    ...(profile?.role === "employer"
      ? [
          { label: "People", href: "/people" },
          { label: "Dashboard", href: "/dashboard/employer" },
        ]
      : []),
    ...(profile?.role === "admin"
      ? [
          { label: "Ops console", href: "/dashboard/ops" },
          { label: "Dashboard", href: "/dashboard/admin" },
          { label: "To confirm", href: "/dashboard/admin?tab=review" },
          { label: "All jobs", href: "/dashboard/admin?tab=jobs" },
          { label: "Inbox", href: "/dashboard/admin?tab=people" },
          { label: "Traffic", href: "/dashboard/admin?tab=more" },
          { label: "My listings", href: "/dashboard/employer" },
        ]
      : []),
  ];

  return (
    <>
      <nav className="sticky top-0 z-[100] bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 items-center">
            <Link
              href="/"
              scroll
              onClick={(event) => {
                if (pathname === "/") {
                  event.preventDefault();
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
              className="flex items-center gap-2"
            >
              <BrandMark size={32} className="h-8 w-8" />
              <span className="text-base font-semibold tracking-tight text-indigo-600">CareersPal</span>
            </Link>

            <div className="hidden md:flex items-center gap-4 shrink-0">
              <Link
                href="/jobs"
                className={`text-sm ${pathname === "/jobs" || pathname.startsWith("/jobs/") ? "text-indigo-600 font-medium" : "text-slate-600 hover:text-slate-900"}`}
              >
                Jobs
              </Link>
              <Link
                href="/companies"
                className={`hidden lg:inline text-sm ${pathname.startsWith("/companies") ? "text-indigo-600 font-medium" : "text-slate-600 hover:text-slate-900"}`}
              >
                Companies
              </Link>
              {isEmployer && (
                <Link
                  href="/people"
                  className={`hidden lg:inline text-sm ${pathname.startsWith("/people") || pathname.startsWith("/p/") ? "text-indigo-600 font-medium" : "text-slate-600 hover:text-slate-900"}`}
                >
                  People
                </Link>
              )}
              <Link
                href="/alerts"
                className={`hidden lg:inline text-sm ${pathname === "/alerts" ? "text-indigo-600 font-medium" : "text-slate-600 hover:text-slate-900"}`}
              >
                Alerts
              </Link>
              <Link href="/pricing" className={`hidden xl:inline text-sm ${pathname === "/pricing" ? "text-indigo-600 font-medium" : "text-slate-600 hover:text-slate-900"}`}>
                Pricing
              </Link>

              <Link
                href={hireHref}
                className="inline-flex h-10 items-center justify-center px-3.5 rounded-lg bg-indigo-600 text-white text-sm font-medium leading-none hover:bg-indigo-700 shrink-0"
              >
                {hireLabel}
              </Link>
              {profile?.role === "admin" && (
                <>
                  <Link
                    href="/dashboard/ops"
                    className="inline-flex h-10 items-center justify-center px-3 rounded-lg bg-zinc-950 text-emerald-300 text-sm font-medium leading-none hover:bg-zinc-800 shrink-0"
                  >
                    Ops
                  </Link>
                  <Link
                    href="/dashboard/admin?tab=review"
                    className="inline-flex h-10 items-center justify-center px-3 rounded-lg bg-slate-800 text-white text-sm font-medium leading-none hover:bg-slate-700 shrink-0"
                  >
                    Admin desk
                  </Link>
                </>
              )}

              {!profile?.email ? (
                <Link href={`/auth?from=${encodeURIComponent(pathname || "/")}`} className="inline-flex h-9 items-center justify-center px-3 rounded-lg border border-slate-200 text-sm font-medium leading-none text-slate-800 hover:bg-slate-50 shrink-0">
                  Sign in
                </Link>
              ) : (
                <div className="relative" ref={accountRef}>
                  <button
                    type="button"
                    onClick={() => setIsAccountOpen((open) => !open)}
                    className="inline-flex h-10 min-w-10 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white pl-1 pr-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
                    aria-haspopup="menu"
                    aria-expanded={isAccountOpen}
                    aria-label="Account menu"
                  >
                    <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-slate-100">
                      {profile.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={profile.image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <AccountIcon />
                      )}
                    </span>
                    Account
                  </button>
                  {isAccountOpen && (
                    <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white shadow-lg py-2 text-sm z-50">
                      <div className="px-4 py-2 border-b border-slate-100 text-slate-500 truncate">{profile.email}</div>
                      {accountLinks.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="block px-4 py-2 text-slate-700 hover:bg-slate-50"
                        >
                          {item.label}
                        </Link>
                      ))}
                      <a href="mailto:info@careerspal.com" className="block px-4 py-2 text-slate-700 hover:bg-slate-50">
                        Help
                      </a>
                      <button
                        type="button"
                        onClick={() => signOut()}
                        className="w-full text-left px-4 py-2 text-indigo-700 font-medium hover:bg-slate-50"
                      >
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="md:hidden flex items-center gap-2">
              {profile?.email && (
                <Link
                  href="/account"
                  className="inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100"
                  aria-label="Account"
                >
                  {profile.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <AccountIcon />
                  )}
                </Link>
              )}
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-800"
                aria-label="Toggle menu"
                aria-expanded={isMenuOpen}
                aria-controls="mobile-menu"
              >
                <div className="w-5 h-4 relative flex flex-col justify-between">
                  <span className={`w-full h-0.5 bg-slate-800 rounded-full ${isMenuOpen ? "rotate-45 translate-x-1" : ""}`} />
                  <span className={`w-full h-0.5 bg-slate-800 rounded-full ${isMenuOpen ? "opacity-0" : ""}`} />
                  <span className={`w-full h-0.5 bg-slate-800 rounded-full ${isMenuOpen ? "-rotate-45 translate-x-1" : ""}`} />
                </div>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div
        id="mobile-menu"
        className={`fixed inset-0 z-[101] bg-white md:hidden flex flex-col ${
          isMenuOpen ? "opacity-100 pointer-events-auto" : "hidden opacity-0 pointer-events-none"
        }`}
        aria-hidden={!isMenuOpen}
      >
        <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-slate-100">
          <span className="text-sm font-semibold text-slate-900">Menu</span>
          <button onClick={closeMobile} className="h-9 w-9 rounded-full border border-slate-200 text-slate-500" aria-label="Close menu">
            ×
          </button>
        </div>
        <div className="px-4 py-3 space-y-1 text-base">
          {!profile?.email && (
            <Link href={`/auth?from=${encodeURIComponent(pathname || "/")}`} onClick={closeMobile} className="block py-3 border-b border-slate-100">
              Sign in
            </Link>
          )}
          <Link href="/jobs" onClick={closeMobile} className="block py-3 border-b border-slate-100">
            Jobs
          </Link>
          <Link href="/companies" onClick={closeMobile} className="block py-3 border-b border-slate-100">
            Companies
          </Link>
          {isEmployer && (
            <Link href="/people" onClick={closeMobile} className="block py-3 border-b border-slate-100">
              People
            </Link>
          )}
          <Link href="/alerts" onClick={closeMobile} className="block py-3 border-b border-slate-100">
            Alerts
          </Link>
          <Link href="/pricing" onClick={closeMobile} className="block py-3 border-b border-slate-100">
            Pricing
          </Link>
          {profile?.email && (
            <>
              <Link href="/account" onClick={closeMobile} className="block py-3 border-b border-slate-100">
                Profile
              </Link>
              <Link href="/account?tab=saved" onClick={closeMobile} className="block py-3 border-b border-slate-100">
                Saved jobs
              </Link>
              <Link href="/account?tab=alerts" onClick={closeMobile} className="block py-3 border-b border-slate-100">
                Alerts
              </Link>
              <Link href="/account?tab=settings" onClick={closeMobile} className="block py-3 border-b border-slate-100">
                Settings
              </Link>
              {profile.role === "employer" && (
                <>
                  <Link href="/people" onClick={closeMobile} className="block py-3 border-b border-slate-100">
                    People
                  </Link>
                  <Link href="/dashboard/employer" onClick={closeMobile} className="block py-3 border-b border-slate-100">
                    Dashboard
                  </Link>
                </>
              )}
              {profile.role === "admin" && (
                <>
                  <Link href="/dashboard/ops" onClick={closeMobile} className="block py-3 border-b border-slate-100">
                    Ops console
                  </Link>
                  <Link href="/dashboard/admin" onClick={closeMobile} className="block py-3 border-b border-slate-100">
                    Dashboard
                  </Link>
                  <Link href="/dashboard/admin?tab=review" onClick={closeMobile} className="block py-3 border-b border-slate-100">
                    To confirm
                  </Link>
                  <Link href="/dashboard/admin?tab=jobs" onClick={closeMobile} className="block py-3 border-b border-slate-100">
                    All jobs
                  </Link>
                  <Link href="/dashboard/admin?tab=people" onClick={closeMobile} className="block py-3 border-b border-slate-100">
                    Inbox
                  </Link>
                  <Link href="/dashboard/admin?tab=more" onClick={closeMobile} className="block py-3 border-b border-slate-100">
                    Traffic
                  </Link>
                  <Link href="/dashboard/employer" onClick={closeMobile} className="block py-3 border-b border-slate-100">
                    My listings
                  </Link>
                </>
              )}
            </>
          )}
          <Link href={hireHref} onClick={closeMobile} className="block py-3 border-b border-slate-100">
            {hireLabel}
          </Link>
          {profile?.email && (
            <button
              type="button"
              onClick={() => {
                closeMobile();
                signOut();
              }}
              className="block w-full text-left py-3 text-indigo-700"
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default Navbar;
