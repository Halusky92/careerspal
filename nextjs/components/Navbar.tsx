"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSupabaseAuth } from "./Providers";
import BrandMark from "./BrandMark";

function NavIcon({ name }: { name: string }) {
  const props = {
    viewBox: "0 0 24 24",
    className: "h-[18px] w-[18px] shrink-0",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  if (name === "jobs" || name === "listings") {
    return (
      <svg {...props}>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7M3 12h18" />
      </svg>
    );
  }
  if (name === "categories") {
    return (
      <svg {...props}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    );
  }
  if (name === "companies" || name === "employers") {
    return (
      <svg {...props}>
        <path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16" />
        <path d="M15 9h3a2 2 0 0 1 2 2v10M4 21h16M8 7h2M8 11h2M8 15h2" />
      </svg>
    );
  }
  if (name === "alerts") {
    return (
      <svg {...props}>
        <path d="M6 9a6 6 0 1 1 12 0c0 7 3 7 3 7H3s3 0 3-7" />
        <path d="M10 19a2 2 0 0 0 4 0" />
      </svg>
    );
  }
  if (name === "pricing") {
    return (
      <svg {...props}>
        <path d="M12 3v18M16 7.5c0-1.5-1.8-2.5-4-2.5s-4 1-4 2.5 1.8 2.5 4 2.5 4 1 4 2.5-1.8 2.5-4 2.5-4-1-4-2.5" />
      </svg>
    );
  }
  if (name === "profile") {
    return (
      <svg {...props}>
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5.5 19c1.4-3 3.6-4.5 6.5-4.5s5.1 1.5 6.5 4.5" />
      </svg>
    );
  }
  if (name === "saved") {
    return (
      <svg {...props}>
        <path d="M7 4h10a1 1 0 0 1 1 1v15l-6-3.2L6 20V5a1 1 0 0 1 1-1z" />
      </svg>
    );
  }
  if (name === "settings") {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
      </svg>
    );
  }
  if (name === "dashboard") {
    return (
      <svg {...props}>
        <rect x="3" y="3" width="8" height="8" rx="1.5" />
        <rect x="13" y="3" width="8" height="5" rx="1.5" />
        <rect x="13" y="10" width="8" height="11" rx="1.5" />
        <rect x="3" y="13" width="8" height="8" rx="1.5" />
      </svg>
    );
  }
  if (name === "ops") {
    return (
      <svg {...props}>
        <path d="M4 15l4-4 3 3 5-6 4 4" />
        <path d="M4 19h16" />
      </svg>
    );
  }
  if (name === "confirm") {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="8" />
        <path d="M8.5 12.5 11 15l4.5-5" />
      </svg>
    );
  }
  if (name === "list") {
    return (
      <svg {...props}>
        <path d="M9 7h11M9 12h11M9 17h11M4 7h.01M4 12h.01M4 17h.01" />
      </svg>
    );
  }
  if (name === "inbox") {
    return (
      <svg {...props}>
        <path d="M3 12h5l2 3h4l2-3h5" />
        <path d="M4 6h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z" />
      </svg>
    );
  }
  if (name === "traffic") {
    return (
      <svg {...props}>
        <path d="M4 19V10M10 19V5M16 19v-7M22 19H2" />
      </svg>
    );
  }
  if (name === "post") {
    return (
      <svg {...props}>
        <path d="M12 5v14M5 12h14" />
      </svg>
    );
  }
  if (name === "help") {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="8" />
        <path d="M9.5 9.5a2.5 2.5 0 1 1 3.2 2.4c-.7.3-1.2.9-1.2 1.6V14" />
        <path d="M12 17h.01" />
      </svg>
    );
  }
  if (name === "sign-in") {
    return (
      <svg {...props}>
        <path d="M14 7V5a2 2 0 0 0-2-2H5v18h7a2 2 0 0 0 2-2v-2" />
        <path d="M10 12h10M17 8l4 4-4 4" />
      </svg>
    );
  }
  if (name === "sign-out") {
    return (
      <svg {...props}>
        <path d="M10 7V5a2 2 0 0 1 2-2h7v18h-7a2 2 0 0 1-2-2v-2" />
        <path d="M4 12h10M11 8l4 4-4 4" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <path d="M15 4h4v4M14 10l5-5M10 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-4" />
    </svg>
  );
}

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
  const router = useRouter();
  const { profile, signOut } = useSupabaseAuth();
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    for (const href of ["/jobs", "/categories", "/companies", "/alerts", "/pricing"]) {
      router.prefetch(href);
    }
  }, [router]);

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

  const showPeopleNav = false;
  const accountLinks = [
    { label: "Profile", href: "/account", icon: "profile" },
    { label: "Saved jobs", href: "/account?tab=saved", icon: "saved" },
    { label: "Alerts", href: "/account?tab=alerts", icon: "alerts" },
    { label: "Settings", href: "/account?tab=settings", icon: "settings" },
    ...(profile?.role === "employer"
      ? [
          ...(showPeopleNav ? [{ label: "People", href: "/people", icon: "profile" }] : []),
          { label: "Dashboard", href: "/dashboard/employer", icon: "dashboard" },
        ]
      : []),
    ...(profile?.role === "admin"
      ? [
          { label: "Ops console", href: "/dashboard/ops", icon: "ops" },
          { label: "Dashboard", href: "/dashboard/admin", icon: "dashboard" },
          { label: "To confirm", href: "/dashboard/admin?tab=review", icon: "confirm" },
          { label: "All jobs", href: "/dashboard/admin?tab=jobs", icon: "list" },
          { label: "Inbox", href: "/dashboard/admin?tab=people", icon: "inbox" },
          { label: "Traffic", href: "/dashboard/admin?tab=more", icon: "traffic" },
          { label: "My listings", href: "/dashboard/employer", icon: "listings" },
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
                href="/categories"
                className={`text-sm ${pathname.startsWith("/categories") ? "text-indigo-600 font-medium" : "text-slate-600 hover:text-slate-900"}`}
              >
                Categories
              </Link>
              <Link
                href="/companies"
                className={`hidden lg:inline text-sm ${pathname.startsWith("/companies") ? "text-indigo-600 font-medium" : "text-slate-600 hover:text-slate-900"}`}
              >
                Companies
              </Link>
              {showPeopleNav && isEmployer && (
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
                          className="flex items-center gap-3 px-4 py-2 text-slate-700 hover:bg-slate-50"
                        >
                          <span className="text-slate-400">
                            <NavIcon name={item.icon} />
                          </span>
                          {item.label}
                        </Link>
                      ))}
                      <Link href="/support" className="flex items-center gap-3 px-4 py-2 text-slate-700 hover:bg-slate-50">
                        <span className="text-slate-400">
                          <NavIcon name="help" />
                        </span>
                        Help
                      </Link>
                      <button
                        type="button"
                        onClick={() => signOut()}
                        className="flex w-full items-center gap-3 px-4 py-2 text-left font-medium text-indigo-700 hover:bg-slate-50"
                      >
                        <NavIcon name="sign-out" />
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="md:hidden flex items-center gap-2">
              {!profile?.email && (
                <Link
                  href={`/auth?from=${encodeURIComponent(pathname || "/")}`}
                  className="text-sm font-medium text-slate-800"
                >
                  Sign in
                </Link>
              )}
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
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-base">
          {!profile?.email && (
            <Link href={`/auth?from=${encodeURIComponent(pathname || "/")}`} onClick={closeMobile} className="flex items-center gap-3 border-b border-slate-100 py-3 text-slate-800">
              <span className="text-slate-400"><NavIcon name="sign-in" /></span>
              Sign in
            </Link>
          )}
          {[
            { href: "/jobs", label: "Jobs", icon: "jobs" },
            { href: "/categories", label: "Categories", icon: "categories" },
            { href: "/companies", label: "Companies", icon: "companies" },
            { href: "/alerts", label: "Alerts", icon: "alerts" },
            { href: "/pricing", label: "Pricing", icon: "pricing" },
          ].map((item) => (
            <Link key={item.href} href={item.href} onClick={closeMobile} className={`flex items-center gap-3 border-b border-slate-100 py-3 ${pathname === item.href || pathname.startsWith(`${item.href}/`) ? "text-indigo-600" : "text-slate-800"}`}>
              <span className={pathname === item.href || pathname.startsWith(`${item.href}/`) ? "text-indigo-600" : "text-slate-400"}><NavIcon name={item.icon} /></span>
              {item.label}
            </Link>
          ))}
          {showPeopleNav && isEmployer && (
            <Link href="/people" onClick={closeMobile} className="flex items-center gap-3 border-b border-slate-100 py-3 text-slate-800">
              <span className="text-slate-400"><NavIcon name="profile" /></span>
              People
            </Link>
          )}
          {profile?.email && (
            <>
              <Link href="/account" onClick={closeMobile} className="flex items-center gap-3 border-b border-slate-100 py-3 text-slate-800">
                <span className="text-slate-400"><NavIcon name="profile" /></span>
                Profile
              </Link>
              <Link href="/account?tab=saved" onClick={closeMobile} className="flex items-center gap-3 border-b border-slate-100 py-3 text-slate-800">
                <span className="text-slate-400"><NavIcon name="saved" /></span>
                Saved jobs
              </Link>
              <Link href="/account?tab=alerts" onClick={closeMobile} className="flex items-center gap-3 border-b border-slate-100 py-3 text-slate-800">
                <span className="text-slate-400"><NavIcon name="alerts" /></span>
                Alerts
              </Link>
              <Link href="/account?tab=settings" onClick={closeMobile} className="flex items-center gap-3 border-b border-slate-100 py-3 text-slate-800">
                <span className="text-slate-400"><NavIcon name="settings" /></span>
                Settings
              </Link>
              {profile.role === "employer" && (
                <Link href="/dashboard/employer" onClick={closeMobile} className="flex items-center gap-3 border-b border-slate-100 py-3 text-slate-800">
                  <span className="text-slate-400"><NavIcon name="dashboard" /></span>
                  Dashboard
                </Link>
              )}
              {profile.role === "admin" && (
                <>
                  <Link href="/dashboard/ops" onClick={closeMobile} className="flex items-center gap-3 border-b border-slate-100 py-3 text-slate-800">
                    <span className="text-slate-400"><NavIcon name="ops" /></span>
                    Ops console
                  </Link>
                  <Link href="/dashboard/admin" onClick={closeMobile} className="flex items-center gap-3 border-b border-slate-100 py-3 text-slate-800">
                    <span className="text-slate-400"><NavIcon name="dashboard" /></span>
                    Dashboard
                  </Link>
                  <Link href="/dashboard/admin?tab=review" onClick={closeMobile} className="flex items-center gap-3 border-b border-slate-100 py-3 text-slate-800">
                    <span className="text-slate-400"><NavIcon name="confirm" /></span>
                    To confirm
                  </Link>
                  <Link href="/dashboard/admin?tab=jobs" onClick={closeMobile} className="flex items-center gap-3 border-b border-slate-100 py-3 text-slate-800">
                    <span className="text-slate-400"><NavIcon name="list" /></span>
                    All jobs
                  </Link>
                  <Link href="/dashboard/admin?tab=people" onClick={closeMobile} className="flex items-center gap-3 border-b border-slate-100 py-3 text-slate-800">
                    <span className="text-slate-400"><NavIcon name="inbox" /></span>
                    Inbox
                  </Link>
                  <Link href="/dashboard/admin?tab=more" onClick={closeMobile} className="flex items-center gap-3 border-b border-slate-100 py-3 text-slate-800">
                    <span className="text-slate-400"><NavIcon name="traffic" /></span>
                    Traffic
                  </Link>
                  <Link href="/dashboard/employer" onClick={closeMobile} className="flex items-center gap-3 border-b border-slate-100 py-3 text-slate-800">
                    <span className="text-slate-400"><NavIcon name="listings" /></span>
                    My listings
                  </Link>
                </>
              )}
            </>
          )}
          <Link href={hireHref} onClick={closeMobile} className="flex items-center gap-3 border-b border-slate-100 py-3 text-slate-800">
            <span className="text-slate-400"><NavIcon name={isEmployer ? "post" : "employers"} /></span>
            {hireLabel}
          </Link>
        </div>
        {profile?.email ? (
          <div className="shrink-0 border-t border-slate-200 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => {
                closeMobile();
                signOut();
              }}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 text-sm font-medium text-white"
            >
              <NavIcon name="sign-out" />
              Sign out
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
};

export default Navbar;
