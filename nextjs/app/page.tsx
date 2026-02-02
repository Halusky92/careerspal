"use client";

import React, { useEffect, useMemo, useState } from "react";
import Navbar from "../../components/Navbar";
import Hero from "../../components/Hero";
import FindJobs from "../../components/FindJobs";
import PostJob from "../../components/PostJob";
import HireTalent from "../../components/HireTalent";
import Pricing from "../../components/Pricing";
import PrivacyPolicy from "../../components/PrivacyPolicy";
import TermsOfService from "../../components/TermsOfService";
import AccessibilityStatement from "../../components/AccessibilityStatement";
import AboutUs from "../../components/AboutUs";
import AIChatPanel from "../../components/AIChatPanel";
import EmployerDashboard from "../../components/EmployerDashboard";
import CandidateDashboard from "../../components/CandidateDashboard";
import AdminDashboard from "../../components/AdminDashboard";
import SalaryInsights from "../../components/SalaryInsights";
import Auth from "../../components/Auth";
import Checkout from "../../components/Checkout";
import JobDetail from "../../components/JobDetail";
import CompanyProfile from "../../components/CompanyProfile";
import Newsletter from "../../components/Newsletter";
import Testimonials from "../../components/Testimonials";
import { Job, Company } from "../../types";
import { MOCK_COMPANIES, MOCK_JOBS } from "../../constants";

type View =
  | "home"
  | "find"
  | "post"
  | "hire"
  | "terms"
  | "pricing"
  | "privacy"
  | "contact"
  | "about"
  | "accessibility"
  | "manage"
  | "auth"
  | "checkout"
  | "job-detail"
  | "company-profile"
  | "salaries"
  | "admin";

export type PlanType = "Standard" | "Featured Pro" | "Elite Managed";

interface User {
  email: string;
  role: "candidate" | "employer";
  savedJobIds?: string[];
}

export default function Page() {
  const [currentView, setCurrentView] = useState<View>("home");
  const [user, setUser] = useState<User | null>(null);

  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  const [pendingJobData, setPendingJobData] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState<{
    type: PlanType;
    price: number;
  }>({ type: "Standard", price: 79 });
  const [localJobs, setLocalJobs] = useState<Job[]>([]);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");

  const allJobs = useMemo(() => {
    return [...localJobs, ...MOCK_JOBS];
  }, [localJobs]);

  useEffect(() => {
    const savedUser = localStorage.getItem("cp_user");
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      if (!parsedUser.savedJobIds) parsedUser.savedJobIds = [];
      setUser(parsedUser);
      if (parsedUser.email === "admin@careerspal.com") {
        setCurrentView("admin");
      }
    }

    const savedLocalJobs = JSON.parse(
      localStorage.getItem("cp_my_jobs") || "[]"
    );
    setLocalJobs(savedLocalJobs);

    const savedJob = sessionStorage.getItem("cp_pending_job");
    if (savedJob) setPendingJobData(JSON.parse(savedJob));
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentView]);

  const handleLogout = () => {
    localStorage.removeItem("cp_user");
    setUser(null);
    setCurrentView("home");
  };

  const handleHeroSearch = (query: string) => {
    setGlobalSearchQuery(query);
    setCurrentView("find");
  };

  const handlePlanSelection = (type: PlanType, price: number) => {
    setSelectedPlan({ type, price });
    if (currentView !== "post") {
      setCurrentView("post");
    }
  };

  const handleJobSubmission = (data: any) => {
    const finalJobData = {
      ...data,
      plan: selectedPlan,
      planType: selectedPlan.type,
    };
    setPendingJobData(finalJobData);
    sessionStorage.setItem("cp_pending_job", JSON.stringify(finalJobData));

    if (!user || user.role !== "employer") {
      setCurrentView("auth");
    } else {
      setCurrentView("checkout");
    }
  };

  const handleAuthSuccess = (u: {
    email: string;
    role: "candidate" | "employer";
  }) => {
    const fullUser: User = { ...u, savedJobIds: [] };
    setUser(fullUser);
    localStorage.setItem("cp_user", JSON.stringify(fullUser));

    if (u.email === "admin@careerspal.com") {
      setCurrentView("admin");
      return;
    }

    const pending = sessionStorage.getItem("cp_pending_job");
    if (pending && u.role === "employer") {
      setPendingJobData(JSON.parse(pending));
      setCurrentView("checkout");
    } else {
      setCurrentView("manage");
    }
  };

  const handleCheckoutSuccess = () => {
    const updatedLocalJobs = JSON.parse(
      localStorage.getItem("cp_my_jobs") || "[]"
    );
    setLocalJobs(updatedLocalJobs);
    setPendingJobData(null);
    sessionStorage.removeItem("cp_pending_job");
    setCurrentView("manage");
  };

  const handleToggleBookmark = (jobId: string) => {
    if (!user) {
      setCurrentView("auth");
      return;
    }
    if (user.role !== "candidate") {
      alert("Only candidates can save jobs.");
      return;
    }

    const currentSaved = user.savedJobIds || [];
    const newSaved = currentSaved.includes(jobId)
      ? currentSaved.filter((id) => id !== jobId)
      : [...currentSaved, jobId];

    const updatedUser = { ...user, savedJobIds: newSaved };
    setUser(updatedUser);
    localStorage.setItem("cp_user", JSON.stringify(updatedUser));
  };

  const handleOpenJobDetail = (job: Job) => {
    setSelectedJob(job);
    setCurrentView("job-detail");
  };

  const handleOpenCompanyProfile = (companyName: string) => {
    const company = MOCK_COMPANIES[companyName] || {
      name: companyName,
      logo: "https://picsum.photos/100",
      website: "#",
      description: "Company information not fully available yet.",
      longDescription: "This company has not completed their elite profile yet.",
      foundedYear: "N/A",
      employeeCount: "N/A",
      headquarters: "Remote",
      images: [],
      techStack: [],
      socialLinks: {},
    };
    setSelectedCompany(company);
    setCurrentView("company-profile");
  };

  const sortedHomeJobs = useMemo(() => {
    return [...allJobs].sort((a, b) => {
      const planWeight = { "Elite Managed": 3, "Featured Pro": 2, Standard: 1 };
      const weightA = planWeight[a.planType || "Standard"] || 1;
      const weightB = planWeight[b.planType || "Standard"] || 1;

      if (weightA !== weightB) {
        return weightB - weightA;
      }

      const timeA = (a as any).timestamp || 0;
      const timeB = (b as any).timestamp || 0;

      return timeB - timeA;
    });
  }, [allJobs]);

  const isNewListing = (postedAt: string) => {
    const lower = postedAt.toLowerCase();
    return (
      lower.includes("just now") ||
      lower.includes("hour") ||
      lower.includes("min")
    );
  };

  const renderView = () => {
    switch (currentView) {
      case "admin":
        return <AdminDashboard onLogout={handleLogout} />;
      case "auth":
        return <Auth onAuthSuccess={handleAuthSuccess} />;
      case "checkout":
        return (
          <Checkout
            jobData={pendingJobData}
            onSuccess={handleCheckoutSuccess}
            onCancel={() => setCurrentView("post")}
          />
        );
      case "find":
        return (
          <>
            <FindJobs
              jobs={allJobs}
              onSelectJob={handleOpenJobDetail}
              onSelectCompany={handleOpenCompanyProfile}
              initialQuery={globalSearchQuery}
              user={user}
              onToggleBookmark={handleToggleBookmark}
            />
            <Testimonials />
            <Newsletter />
          </>
        );
      case "salaries":
        return <SalaryInsights onBrowse={() => setCurrentView("find")} />;
      case "job-detail":
        return selectedJob ? (
          <JobDetail
            job={selectedJob}
            allJobs={allJobs}
            onBack={() => setCurrentView("find")}
            onSelectJob={handleOpenJobDetail}
            onSelectCompany={handleOpenCompanyProfile}
          />
        ) : (
          <FindJobs
            jobs={allJobs}
            onSelectJob={handleOpenJobDetail}
            onSelectCompany={handleOpenCompanyProfile}
            user={user}
            onToggleBookmark={handleToggleBookmark}
          />
        );
      case "company-profile":
        return selectedCompany ? (
          <CompanyProfile
            company={selectedCompany}
            companyJobs={allJobs.filter((j) => j.company === selectedCompany.name)}
            onBack={() => setCurrentView("find")}
            onSelectJob={handleOpenJobDetail}
          />
        ) : (
          <FindJobs
            jobs={allJobs}
            onSelectJob={handleOpenJobDetail}
            onSelectCompany={handleOpenCompanyProfile}
            user={user}
            onToggleBookmark={handleToggleBookmark}
          />
        );
      case "post":
        return (
          <PostJob
            onComplete={handleJobSubmission}
            selectedPlan={selectedPlan}
            onUpgradePlan={handlePlanSelection}
          />
        );
      case "manage":
        if (user?.role === "employer") {
          return (
            <EmployerDashboard
              onUpgrade={() => setCurrentView("pricing")}
              onPostJob={() => {
                setSelectedPlan({ type: "Standard", price: 79 });
                setCurrentView("post");
              }}
            />
          );
        }
        return (
          <CandidateDashboard
            onBrowse={() => setCurrentView("find")}
            user={user}
            allJobs={allJobs}
          />
        );
      case "hire":
        return (
          <HireTalent
            onPostJob={() => {
              setSelectedPlan({ type: "Standard", price: 79 });
              setCurrentView("post");
            }}
          />
        );
      case "pricing":
        return <Pricing onSelectPlan={handlePlanSelection} />;
      case "about":
        return <AboutUs />;
      case "privacy":
        return <PrivacyPolicy />;
      case "terms":
        return <TermsOfService />;
      case "accessibility":
        return <AccessibilityStatement />;
      case "contact":
        return (
          <div className="py-24 max-w-4xl mx-auto px-4 text-center">
            <div className="mb-16">
              <h1 className="text-6xl font-black text-slate-900 mb-6 tracking-tighter leading-none">
                Let's Build the <span className="text-gradient">Future.</span>
              </h1>
              <p className="text-xl text-slate-500 font-medium max-w-2xl mx-auto italic leading-relaxed">
                Have questions about hiring or want to optimize your Notion
                workspace? I am here to help.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div className="bg-white p-12 rounded-[4rem] shadow-2xl border border-slate-50 relative group">
                <div className="relative w-56 h-56 mx-auto mb-8">
                  <div className="absolute inset-0 bg-indigo-100 rounded-[3rem] scale-110 blur-2xl opacity-40 group-hover:opacity-60 transition-opacity"></div>
                  <img
                    src="https://raw.githubusercontent.com/stackblitz/stackblitz-images/main/marek-bilek-avatar.jpg"
                    alt="Mgr. Marek Bilek"
                    className="w-full h-full object-cover rounded-[2.5rem] border-[8px] border-white shadow-2xl relative z-10"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "https://i.pravatar.cc/400?u=marekbilek";
                    }}
                  />
                  <div className="absolute -bottom-4 -right-4 bg-indigo-600 text-white p-4 rounded-2xl shadow-xl z-20 animate-bounce">
                    <svg
                      className="w-6 h-6"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                    </svg>
                  </div>
                </div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-1">
                  Mgr. Marek Bilek
                </h2>
                <p className="text-indigo-600 font-black uppercase tracking-[0.4em] text-[10px] mb-6">
                  CEO & Founder, CareersPal Elite
                </p>
                <div className="flex justify-center gap-3">
                  <div className="px-5 py-2.5 bg-indigo-50 rounded-2xl text-[10px] font-black text-indigo-600 uppercase tracking-widest border border-indigo-100 shadow-sm">
                    Notion Certified
                  </div>
                  <div className="px-5 py-2.5 bg-slate-50 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest border border-slate-100">
                    Ops Architect
                  </div>
                </div>
              </div>

              <div className="space-y-6 text-left">
                <div className="bg-indigo-600 p-12 rounded-[3.5rem] text-white shadow-2xl shadow-indigo-200 group hover:-translate-y-2 transition-transform cursor-pointer relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                  <h3 className="text-xs font-black uppercase tracking-[0.4em] opacity-60 mb-6">
                    Direct Contact
                  </h3>
                  <p className="text-2xl sm:text-3xl font-black mb-3 break-words relative z-10">
                    info@careerspal.com
                  </p>
                  <p className="text-indigo-200 font-bold italic relative z-10">
                    I reply personally within 24 hours.
                  </p>
                </div>

                <div className="bg-slate-900 p-12 rounded-[3.5rem] text-white group hover:-translate-y-2 transition-transform cursor-pointer">
                  <h3 className="text-xs font-black uppercase tracking-[0.4em] opacity-40 mb-6">
                    Social Ecosystem
                  </h3>
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center font-black text-2xl text-slate-900 shadow-xl">
                      in
                    </div>
                    <div>
                      <p className="font-black text-xl">
                        LinkedIn Professional
                      </p>
                      <p className="text-slate-500 text-sm font-medium">
                        Join my network of 4k+ experts.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return (
          <>
            <Hero
              onBrowse={() => setCurrentView("find")}
              onJoinPool={() => setCurrentView("hire")}
              onSearch={handleHeroSearch}
              jobs={allJobs}
            />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-10 pb-20">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-6">
                  <div className="flex items-center justify-between px-2 mb-2">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                      {localJobs.length > 0
                        ? "Featured & Latest Roles"
                        : "Latest Roles"}
                    </h3>
                    <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">
                      Showing Top 5
                    </span>
                  </div>

                  {sortedHomeJobs.slice(0, 5).map((job) => {
                    const isElite = job.planType === "Elite Managed";
                    const isPro = job.planType === "Featured Pro";
                    const isNew = isNewListing(job.postedAt);

                    return (
                      <div
                        key={job.id}
                        onClick={() => handleOpenJobDetail(job)}
                        className={`
                          p-6 rounded-[2.5rem] shadow-lg transition-all cursor-pointer flex items-center justify-between group relative
                          ${
                            isElite
                              ? "bg-slate-900 text-white border-2 border-slate-800"
                              : isPro
                              ? "bg-white border-2 border-indigo-100 ring-2 ring-indigo-50"
                              : "bg-white border border-transparent hover:border-indigo-100"
                          }
                        `}
                      >
                        {(isElite || isPro) && (
                          <div
                            className={`absolute -top-3 left-6 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm
                            ${
                              isElite
                                ? "bg-amber-400 text-slate-900"
                                : "bg-indigo-600 text-white"
                            }`}
                          >
                            {isElite ? "Elite" : "Featured"}
                          </div>
                        )}

                        {isNew && (
                          <div className="absolute -top-3 right-8 animate-pulse">
                            <span className="bg-red-500 text-white text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-red-200 shadow-lg border-2 border-white">
                              New Drop
                            </span>
                          </div>
                        )}

                        <div className="flex items-center space-x-6">
                          <div
                            className={`w-14 h-14 rounded-xl flex items-center justify-center p-1 relative
                             ${isElite ? "bg-white/10" : "bg-slate-50 border"}
                          `}
                          >
                            <img
                              src={job.logo}
                              alt=""
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <div>
                            <h4
                              className={`font-black transition-colors ${
                                isElite
                                  ? "text-white"
                                  : "text-slate-900 group-hover:text-indigo-600"
                              }`}
                            >
                              {job.title}
                            </h4>
                            <div className="flex items-center gap-3">
                              <p
                                className={`font-bold text-[10px] uppercase tracking-wider ${
                                  isElite ? "text-indigo-300" : "text-indigo-600"
                                }`}
                              >
                                {job.company}
                              </p>
                              <span
                                className={`text-[10px] ${
                                  isElite ? "text-slate-500" : "text-slate-300"
                                }`}
                              >
                                •
                              </span>
                              <span
                                className={`text-[10px] font-black uppercase tracking-widest ${
                                  isElite ? "text-slate-400" : "text-slate-400"
                                }`}
                              >
                                {job.location}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end">
                          <span
                            className={`font-black text-lg tracking-tighter ${
                              isElite ? "text-white" : "text-slate-900"
                            }`}
                          >
                            {job.salary}
                          </span>
                          {job.matchScore && (
                            <span
                              className={`text-[9px] font-black px-2 py-0.5 rounded-lg mt-1 border
                               ${
                                 isElite
                                   ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                   : "bg-emerald-50 text-emerald-600 border-emerald-100"
                               }
                            `}
                            >
                              AI Match: {job.matchScore}%
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <div className="pt-4">
                    <button
                      onClick={() => {
                        setGlobalSearchQuery("");
                        setCurrentView("find");
                      }}
                      className="w-full py-4 rounded-[2rem] bg-white border-2 border-slate-100 text-slate-600 font-black uppercase tracking-widest text-xs hover:border-indigo-600 hover:text-indigo-600 transition-all shadow-sm"
                    >
                      View All {allJobs.length} Open Positions →
                    </button>
                  </div>
                </div>
                <div className="lg:col-span-4">
                  <AIChatPanel jobs={allJobs} />
                </div>
              </div>
            </main>
            <Testimonials />
            <Newsletter />
          </>
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FD]">
      {currentView !== "admin" && (
        <Navbar
          onNavigate={(v) => {
            if (v === "find") setGlobalSearchQuery("");
            if (v === "post") setSelectedPlan({ type: "Standard", price: 79 });
            setCurrentView(v as any);
          }}
          currentView={currentView}
          user={user}
          onLogout={handleLogout}
        />
      )}

      <div className="flex-grow">{renderView()}</div>

      {currentView !== "admin" && (
        <footer className="bg-slate-900 text-white pt-24 pb-12 mt-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-20">
              <div className="space-y-6">
                <div
                  className="flex items-center space-x-3 group cursor-pointer"
                  onClick={() => setCurrentView("home")}
                >
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
                    <span className="text-white font-black text-lg">C</span>
                  </div>
                  <span className="text-xl font-black tracking-tighter">
                    CareersPal
                  </span>
                </div>
                <p className="text-slate-400 text-sm font-medium leading-relaxed">
                  The elite ecosystem for Notion-first professionals.
                </p>
              </div>
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-8">
                  Ecosystem
                </h4>
                <ul className="space-y-4 text-left">
                  <li>
                    <button
                      onClick={() => {
                        setGlobalSearchQuery("");
                        setCurrentView("find");
                      }}
                      className="text-slate-400 hover:text-white font-bold text-sm transition-colors"
                    >
                      Find Roles
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setCurrentView("hire")}
                      className="text-slate-400 hover:text-white font-bold text-sm transition-colors"
                    >
                      Talent Pool
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setCurrentView("salaries")}
                      className="text-slate-400 hover:text-white font-bold text-sm transition-colors"
                    >
                      Salaries
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => {
                        setSelectedPlan({ type: "Standard", price: 79 });
                        setCurrentView("post");
                      }}
                      className="text-slate-400 hover:text-white font-bold text-sm transition-colors"
                    >
                      Post a Role
                    </button>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-8">
                  Platform
                </h4>
                <ul className="space-y-4 text-left">
                  <li>
                    <button
                      onClick={() => setCurrentView("about")}
                      className="text-slate-400 hover:text-white font-bold text-sm transition-colors"
                    >
                      Our Mission
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setCurrentView("contact")}
                      className="text-slate-400 hover:text-white font-bold text-sm transition-colors"
                    >
                      Contact
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setCurrentView("manage")}
                      className="text-slate-400 hover:text-white font-bold text-sm transition-colors"
                    >
                      Dashboard
                    </button>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-8">
                  Legal
                </h4>
                <ul className="space-y-4 text-left">
                  <li>
                    <button
                      onClick={() => setCurrentView("privacy")}
                      className="text-slate-400 hover:text-white font-bold text-sm transition-colors"
                    >
                      Privacy Policy
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setCurrentView("terms")}
                      className="text-slate-400 hover:text-white font-bold text-sm transition-colors"
                    >
                      Terms of Service
                    </button>
                  </li>
                </ul>
              </div>
            </div>
            <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">
                © 2026 CareersPal Elite • Mgr. Marek Bilek
              </p>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
