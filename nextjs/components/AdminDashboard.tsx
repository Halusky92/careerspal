"use client";


import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from "next/navigation";
import { Subscriber } from '../services/notificationService';
import { Job } from '../types';
import { useSupabaseAuth } from "./Providers";
import { authFetch } from "../lib/authFetch";

type AnalyticsPeriod = {
  totalViews: number;
  uniqueVisitors: number;
  newVisitors: number;
  returningVisitors: number;
};

type AnalyticsPoint = { date: string; count: number };

type AnalyticsPayload = {
  periods: {
    today: AnalyticsPeriod;
    week: AnalyticsPeriod;
    month: AnalyticsPeriod;
    all: AnalyticsPeriod;
  };
  dailyViews: AnalyticsPoint[];
  dailyPosts: AnalyticsPoint[];
};

interface AdminDashboardProps {
  onLogout: () => void;
}

const getLocalJson = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [jobs, setJobs] = useState<Job[]>(() => getLocalJson<Job[]>('cp_my_jobs', []));
  const [adminStats, setAdminStats] = useState({ users: 0, jobs: 0, savedJobs: 0, files: 0 });
  const [roleSummary, setRoleSummary] = useState<Record<string, number>>({});
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [jobQuery, setJobQuery] = useState("");
  const [showJobSuggestions, setShowJobSuggestions] = useState(false);
  const [jobSort, setJobSort] = useState<"newest" | "oldest">("newest");
  const jobSearchRef = useRef<HTMLDivElement>(null);
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const { accessToken } = useSupabaseAuth();
  const router = useRouter();
  const enableTestPrice = process.env.NEXT_PUBLIC_ENABLE_TEST_PRICE === "true";
  const [testPaymentState, setTestPaymentState] = useState<{ loading: boolean; error: string | null }>({
    loading: false,
    error: null,
  });
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    title: string;
    description: string;
    location: string;
    remotePolicy: string;
    type: string;
    salary: string;
  } | null>(null);
  const formatDate = (value?: number) => {
    if (!value) return "N/A";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleDateString();
  };
  const getPlanDurationDays = (job: Job) => {
    const plan = job.planType || job.plan?.type;
    if (plan === "Elite Managed") return 60;
    if (plan === "Featured Pro") return 45;
    return 30;
  };
  const getExpiryDate = (job: Job) => {
    if (!job.timestamp) return "N/A";
    const expires = new Date(job.timestamp + getPlanDurationDays(job) * 24 * 60 * 60 * 1000);
    return Number.isNaN(expires.getTime()) ? "N/A" : expires.toLocaleDateString();
  };
  const getRemainingDays = (job: Job) => {
    if (!job.timestamp) return null;
    const expires = new Date(job.timestamp + getPlanDurationDays(job) * 24 * 60 * 60 * 1000);
    if (Number.isNaN(expires.getTime())) return null;
    const diffMs = expires.getTime() - Date.now();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  };
  const startEditJob = (job: Job) => {
    setEditingJobId(job.id);
    setEditDraft({
      title: job.title || "",
      description: job.description || "",
      location: job.location || "",
      remotePolicy: job.remotePolicy || "",
      type: job.type || "",
      salary: job.salary || "",
    });
  };
  const cancelEditJob = () => {
    setEditingJobId(null);
    setEditDraft(null);
  };
  const saveJobEdits = async (id: string) => {
    if (!accessToken || !editDraft) return;
    try {
      const response = await authFetch(
        `/api/admin/jobs/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editDraft),
        },
        accessToken,
      );
      if (!response.ok) return;
      const data = (await response.json()) as { job?: Job };
      if (data.job) {
        setJobs((prev) => prev.map((j) => (j.id === id ? data.job! : j)));
      }
      cancelEditJob();
    } catch {
      // noop
    }
  };

  const stats = useMemo(() => {
    const revenue = jobs.reduce((acc, job) => acc + (job.plan?.price || 0), 0);
    return { revenue };
  }, [jobs]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (jobSearchRef.current && !jobSearchRef.current.contains(event.target as Node)) {
        setShowJobSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const loadAdminStats = async () => {
      try {
        if (!accessToken) return;
        const response = await authFetch("/api/admin/stats", {}, accessToken);
        const data = (await response.json()) as { users?: number; jobs?: number; savedJobs?: number; files?: number };
        setAdminStats({
          users: data.users || 0,
          jobs: data.jobs || 0,
          savedJobs: data.savedJobs || 0,
          files: data.files || 0,
        });
        const rolesRes = await authFetch("/api/admin/role-summary", {}, accessToken);
        const rolesData = (await rolesRes.json()) as { summary?: Record<string, number> };
        setRoleSummary(rolesData.summary || {});
      } catch {
        // noop
      }
    };
    loadAdminStats();
  }, [accessToken]);

  useEffect(() => {
    const loadSubscribers = async () => {
      try {
        if (!accessToken) return;
        const response = await authFetch("/api/admin/subscribers", {}, accessToken);
        if (!response.ok) return;
        const data = (await response.json()) as { subscribers?: Subscriber[] };
        setSubscribers(data.subscribers || []);
      } catch {
        // noop
      }
    };
    loadSubscribers();
  }, [accessToken]);

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        if (!accessToken) return;
        const response = await authFetch("/api/admin/analytics", {}, accessToken);
        if (!response.ok) return;
        const data = (await response.json()) as AnalyticsPayload;
        setAnalytics(data);
      } catch {
        // noop
      }
    };
    loadAnalytics();
  }, [accessToken]);

  useEffect(() => {
    const loadJobs = async () => {
      try {
        if (!accessToken) return;
        const response = await authFetch("/api/admin/jobs", {}, accessToken);
        if (!response.ok) return;
        const data = (await response.json()) as { jobs?: Job[] };
        if (data.jobs) {
          setJobs(data.jobs);
        }
      } catch {
        // fallback to local storage
      }
    };
    loadJobs();
  }, [accessToken]);

  const updateJobStatus = async (id: string, status: string) => {
    try {
      if (!accessToken) return;
      const response = await authFetch(
        `/api/admin/jobs/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
        accessToken,
      );
      if (!response.ok) return;
      const data = (await response.json()) as { job?: Job };
      if (data.job) {
        setJobs((prev) => prev.map((j) => (j.id === id ? data.job! : j)));
      }
    } catch {
      // noop
    }
  };

  const handleDeleteJob = async (id: string) => {
    if (!accessToken) return;
    if (!confirm("Delete this job permanently?")) return;
    try {
      const response = await authFetch(
        `/api/admin/jobs/${id}`,
        { method: "DELETE" },
        accessToken,
      );
      if (!response.ok) return;
      setJobs((prev) => prev.filter((job) => job.id !== id));
      setExpandedJobId((prev) => (prev === id ? null : prev));
    } catch {
      // noop
    }
  };

  const startTestCheckout = async () => {
    if (!accessToken) return;
    setTestPaymentState({ loading: true, error: null });
    const runCheckout = async (jobId: string) => {
      const response = await authFetch(
        "/api/stripe/checkout",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId, price: 0.5, planName: "Standard (Test)" }),
        },
        accessToken,
      );
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        throw new Error(data.error || "Failed to start checkout.");
      }
      window.location.href = data.url;
    };

    try {
      try {
        const cachedId = sessionStorage.getItem("cp_test_job_id");
        if (cachedId) {
          await runCheckout(cachedId);
          return;
        }
      } catch {
        // ignore cache issues
      }

      const createResponse = await authFetch(
        "/api/employer/jobs",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Test Payment Listing",
            description: "Stripe live payment test listing.",
            company: "CareersPal Test",
            applyUrl: "https://careerspal.com",
            location: "Remote",
            remotePolicy: "Remote",
            type: "Full-time",
            salary: "$0.50 test",
            category: "Operations",
            tags: ["Test"],
            planType: "Standard",
            planPrice: 1,
            status: "draft",
          }),
        },
        accessToken,
      );
      const created = (await createResponse.json()) as { job?: Job; error?: string };
      if (!createResponse.ok || !created.job?.id) {
        throw new Error(created.error || "Failed to create test job.");
      }
      try {
        sessionStorage.setItem("cp_test_job_id", created.job.id);
      } catch {
        // ignore
      }
      await runCheckout(created.job.id);
    } catch (error) {
      setTestPaymentState({
        loading: false,
        error: error instanceof Error ? error.message : "Failed to start test checkout.",
      });
      return;
    }
  };

  const handleDeleteSubscriber = async (email: string) => {
    if (!accessToken) return;
    if (!confirm(`Remove ${email} from list?`)) return;
    try {
      const response = await authFetch(
        "/api/admin/subscribers",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
        accessToken,
      );
      if (!response.ok) return;
      setSubscribers((prev) => prev.filter((s) => s.email !== email));
    } catch {
      // noop
    }
  };

  const handleExport = async (href: string, filename: string) => {
    if (!accessToken) return;
    try {
      const response = await authFetch(href, {}, accessToken);
      if (!response.ok) return;
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch {
      // noop
    }
  };

  const filteredJobs = useMemo(() => {
    const query = jobQuery.trim().toLowerCase();
    if (!query) return jobs;
    return jobs.filter((job) => {
      const title = job.title?.toLowerCase() || "";
      return title.includes(query);
    });
  }, [jobs, jobQuery]);
  const sortedJobs = useMemo(() => {
    const direction = jobSort === "newest" ? -1 : 1;
    return [...filteredJobs].sort((a, b) => {
      const aTime = a.timestamp ?? 0;
      const bTime = b.timestamp ?? 0;
      return aTime === bTime ? 0 : aTime > bTime ? direction : -direction;
    });
  }, [filteredJobs, jobSort]);

  const jobSuggestions = useMemo(() => {
    if (!jobQuery.trim() || jobQuery.length < 1) return [];
    const lowQuery = jobQuery.toLowerCase();
    const titles = jobs.filter((j) => j.title?.toLowerCase().includes(lowQuery)).map((j) => j.title);
    return Array.from(new Set(titles)).slice(0, 6);
  }, [jobQuery, jobs]);

  const audienceSplit = useMemo(() => {
    const period = analytics?.periods?.week;
    if (!period || !period.uniqueVisitors) {
      return { newPct: 0, returningPct: 0 };
    }
    const newPct = Math.round((period.newVisitors / period.uniqueVisitors) * 100);
    return { newPct, returningPct: 100 - newPct };
  }, [analytics]);

  const chartViews = analytics?.dailyViews || [];
  const chartPosts = analytics?.dailyPosts || [];
  const maxViews = Math.max(...chartViews.map((item) => item.count), 1);
  const maxPosts = Math.max(...chartPosts.map((item) => item.count), 1);

  const pendingJobs = sortedJobs.filter((job) => job.status === "pending_review");
  const archivedJobs = sortedJobs.filter((job) => job.status === "private");
  const activeJobs = sortedJobs.filter((job) => job.status !== "pending_review" && job.status !== "private");

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-200 font-sans p-4 sm:p-6 md:p-10 animate-in fade-in">
      {/* Top Bar */}
      <div className="max-w-[1400px] mx-auto mb-8 sm:mb-10 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-6 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 sm:w-14 sm:h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-xl sm:text-2xl shadow-[0_0_30px_rgba(79,70,229,0.3)]">
            CP
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Shadow Command</h1>
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
               <p className="text-[10px] sm:text-xs font-mono text-emerald-500 uppercase tracking-widest">System Online • Encrypted</p>
            </div>
          </div>
        </div>
        <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2">
          {enableTestPrice && (
            <button
              onClick={startTestCheckout}
              disabled={testPaymentState.loading}
              className={`w-full sm:w-auto px-6 sm:px-8 py-3 border rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all ${
                testPaymentState.loading
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-200/60 cursor-wait"
                  : "bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-400 hover:text-emerald-200 text-emerald-300"
              }`}
            >
              {testPaymentState.loading ? "Starting test checkout..." : "Test payment $0.50"}
            </button>
          )}
          <button onClick={onLogout} className="w-full sm:w-auto px-6 sm:px-8 py-3 bg-slate-900 border border-slate-700 hover:border-red-500 hover:text-red-400 text-slate-400 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all">
            Terminate Session
          </button>
        </div>
        {enableTestPrice && testPaymentState.error && (
          <div className="w-full text-[10px] sm:text-xs font-black uppercase tracking-widest text-amber-300">
            Test checkout failed: {testPaymentState.error}
          </div>
        )}
      </div>

      <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-12 grid grid-cols-2 md:grid-cols-4 gap-4 order-6">
          {[
            { label: "Users", value: adminStats.users },
            { label: "Jobs", value: adminStats.jobs },
            { label: "Saved", value: adminStats.savedJobs },
            { label: "Files", value: adminStats.files },
          ].map((item) => (
            <div key={item.label} className="bg-[#0F172A] border border-slate-800 rounded-2xl p-4 text-center">
              <div className="text-2xl font-black text-white">{item.value}</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{item.label}</div>
            </div>
          ))}
        </div>
        <div className="lg:col-span-12 flex flex-wrap gap-2 order-7">
          {Object.entries(roleSummary).map(([role, count]) => (
            <span
              key={role}
              className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-indigo-200 border border-indigo-700/40 bg-indigo-900/30"
            >
              {role}: {count}
            </span>
          ))}
        </div>
        <div className="lg:col-span-12 flex flex-wrap gap-3 order-8">
          {[
            { label: "Users CSV", href: "/api/admin/users/export", file: "users-export.csv" },
            { label: "Jobs CSV", href: "/api/admin/jobs/export", file: "jobs-export.csv" },
            { label: "Saved CSV", href: "/api/admin/saved-jobs/export", file: "saved-jobs-export.csv" },
            { label: "Files CSV", href: "/api/admin/files/export", file: "files-export.csv" },
            { label: "Audit CSV", href: "/api/admin/audit/export", file: "audit-export.csv" },
          ].map((item) => (
            <button
              key={item.href}
              onClick={() => handleExport(item.href, item.file)}
              disabled={!accessToken}
              className={`px-4 py-2 rounded-xl border border-slate-800 text-[10px] font-black uppercase tracking-widest ${
                accessToken ? "text-slate-300 hover:border-indigo-500 hover:text-indigo-300" : "text-slate-500 opacity-60 cursor-not-allowed"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="lg:col-span-12 order-0">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Job Board</h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">
                  Manage pending approvals and active roles
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-amber-300 border border-amber-600/40 bg-amber-600/10">
                  Pending {pendingJobs.length}
                </span>
                <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-emerald-300 border border-emerald-600/40 bg-emerald-600/10">
                  Active {activeJobs.length}
                </span>
                <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-slate-300 border border-slate-700 bg-slate-800/60">
                  Archived {archivedJobs.length}
                </span>
              </div>
            </div>
            <div ref={jobSearchRef} className="relative">
              <div className="relative flex items-center bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3">
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={jobQuery}
                  onChange={(event) => {
                    setJobQuery(event.target.value);
                    setShowJobSuggestions(true);
                  }}
                  onFocus={() => setShowJobSuggestions(true)}
                  placeholder="Search job titles..."
                  className="w-full bg-transparent px-3 text-sm font-bold text-slate-200 outline-none placeholder:text-slate-600"
                />
                {jobQuery && (
                  <button
                    onClick={() => {
                      setJobQuery("");
                      setShowJobSuggestions(false);
                    }}
                    className="text-slate-500 hover:text-indigo-400"
                    aria-label="Clear search"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {showJobSuggestions && jobSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 mt-2 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-30">
                  {jobSuggestions.map((suggestion, idx) => (
                    <button
                      key={`${suggestion}-${idx}`}
                      onClick={() => {
                        setJobQuery(suggestion);
                        setShowJobSuggestions(false);
                      }}
                      className="w-full text-left px-4 py-3 text-sm font-bold text-slate-300 hover:bg-slate-900 hover:text-white transition-colors border-b border-slate-800 last:border-none"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Sort</span>
              <button
                onClick={() => setJobSort("newest")}
                className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                  jobSort === "newest"
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-slate-950 text-slate-400 border-slate-800 hover:border-indigo-500/40"
                }`}
              >
                Newest
              </button>
              <button
                onClick={() => setJobSort("oldest")}
                className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                  jobSort === "oldest"
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-slate-950 text-slate-400 border-slate-800 hover:border-indigo-500/40"
                }`}
              >
                Oldest
              </button>
            </div>
            <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
              Showing {filteredJobs.length} / {jobs.length} jobs
            </div>
          </div>
        </div>
        
        {/* ROW 1: ANALYTICS CARDS (Left) */}
        <div className="lg:col-span-3 space-y-6 order-10">
           {/* Total Views Card */}
           <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 backdrop-blur-sm relative overflow-hidden group">
              <div className="relative z-10">
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Impressions</p>
                 <p className="text-4xl font-black text-white">{(analytics?.periods.all.totalViews || 0).toLocaleString()}</p>
                 <div className="mt-4 flex gap-2 text-[10px] font-bold">
                    <span className="text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">
                      {analytics ? `${analytics.periods.week.totalViews.toLocaleString()} last 7d` : "Loading..."}
                    </span>
                 </div>
              </div>
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-500/20 rounded-full blur-2xl group-hover:bg-indigo-500/30 transition-all"></div>
           </div>

           {/* Unique vs Returning */}
           <div className="bg-slate-900/50 p-6 rounded-3xl border border-slate-800 backdrop-blur-sm">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Audience Split</p>
              <div className="flex items-end justify-between mb-2">
                 <span className="text-indigo-400 font-bold text-xs">New</span>
                 <span className="text-white font-black">{audienceSplit.newPct}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full mb-4 overflow-hidden">
                 <div className="h-full bg-indigo-500" style={{ width: `${audienceSplit.newPct}%` }}></div>
              </div>
              <div className="flex items-end justify-between mb-2">
                 <span className="text-purple-400 font-bold text-xs">Returning</span>
                 <span className="text-white font-black">{audienceSplit.returningPct}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                 <div className="h-full bg-purple-500" style={{ width: `${audienceSplit.returningPct}%` }}></div>
              </div>
           </div>

           {/* Revenue */}
           <div className="bg-gradient-to-br from-indigo-900/50 to-slate-900 p-6 rounded-3xl border border-indigo-500/30 backdrop-blur-sm relative overflow-hidden">
              <div className="relative z-10">
                 <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1">Total Revenue</p>
                 <p className="text-4xl font-black text-white">${stats.revenue.toLocaleString()}</p>
                 <p className="text-xs text-indigo-400/60 font-medium mt-1">Real-time DB Calc</p>
              </div>
           </div>
        </div>

        {/* ROW 1: TRAFFIC CHARTS */}
        <div className="lg:col-span-6 order-11">
           <div className="bg-[#0F172A] rounded-[2.5rem] border border-slate-800 h-full relative overflow-hidden flex flex-col min-h-[500px]">
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/30">
                 <h3 className="text-sm font-black text-white uppercase tracking-widest">Traffic & Job Posts</h3>
                 <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    <span className="text-[10px] font-mono text-emerald-400">REAL-TIME</span>
                 </div>
              </div>
              
              <div className="flex-1 p-6 grid grid-cols-1 gap-6">
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Page views · last 30 days</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">
                      {analytics ? analytics.periods.month.totalViews.toLocaleString() : "—"}
                    </span>
                  </div>
                  <div className="flex items-end gap-1 h-28">
                    {chartViews.map((point) => (
                      <div
                        key={`views-${point.date}`}
                        className="flex-1 rounded-sm bg-indigo-500/70"
                        style={{ height: `${Math.max(8, (point.count / maxViews) * 100)}%` }}
                        title={`${point.date}: ${point.count}`}
                      />
                    ))}
                  </div>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Job posts · last 30 days</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300">
                      {chartPosts.reduce((sum, point) => sum + point.count, 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-end gap-1 h-28">
                    {chartPosts.map((point) => (
                      <div
                        key={`posts-${point.date}`}
                        className="flex-1 rounded-sm bg-emerald-500/70"
                        style={{ height: `${Math.max(8, (point.count / maxPosts) * 100)}%` }}
                        title={`${point.date}: ${point.count}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
           </div>
        </div>

        {/* ROW 1: TRAFFIC SUMMARY (Right) */}
        <div className="lg:col-span-3 space-y-6 order-12">
          <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800 backdrop-blur-sm h-full flex flex-col justify-center">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6">Traffic Summary</h3>
            <div className="space-y-4">
              {[
                { label: "Today", value: analytics?.periods.today.totalViews ?? 0 },
                { label: "Last 7 days", value: analytics?.periods.week.totalViews ?? 0 },
                { label: "Last 30 days", value: analytics?.periods.month.totalViews ?? 0 },
                { label: "All time", value: analytics?.periods.all.totalViews ?? 0 },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{item.label}</span>
                  <span className="text-sm font-black text-slate-100">{item.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>


        {/* ROW 2: SUBSCRIBERS */}
        <div className="lg:col-span-12 order-13">
          <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-900">
              <div className="flex items-center gap-3">
                 <h3 className="text-lg font-black text-white">Encrypted Subscriber DB</h3>
                 <span className="bg-indigo-500/20 text-indigo-400 text-[10px] font-black px-2 py-1 rounded border border-indigo-500/30">
                    {subscribers.length} RECORDS
                 </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm text-slate-400">
                <thead className="bg-slate-950/50 uppercase text-[9px] sm:text-[10px] font-black tracking-widest text-slate-500">
                  <tr>
                    <th className="px-4 sm:px-8 py-3 sm:py-4 whitespace-nowrap">Identity</th>
                    <th className="px-4 sm:px-8 py-3 sm:py-4 whitespace-nowrap">Preference</th>
                    <th className="px-4 sm:px-8 py-3 sm:py-4 whitespace-nowrap">Timestamp</th>
                    <th className="px-4 sm:px-8 py-3 sm:py-4 text-right whitespace-nowrap">Protocol</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {subscribers.length > 0 ? subscribers.map((sub, i) => (
                    <tr key={i} className="hover:bg-slate-800/50 transition-colors group">
                      <td className="px-4 sm:px-8 py-3 sm:py-4 font-bold text-slate-300 group-hover:text-white whitespace-nowrap">{sub.email}</td>
                      <td className="px-4 sm:px-8 py-3 sm:py-4">
                        <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider ${
                          sub.preference === 'All' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {sub.preference}
                        </span>
                      </td>
                      <td className="px-4 sm:px-8 py-3 sm:py-4 font-mono text-xs text-slate-500 whitespace-nowrap">{new Date(sub.joinedAt).toLocaleDateString()}</td>
                      <td className="px-4 sm:px-8 py-3 sm:py-4 text-right">
                        <button onClick={() => handleDeleteSubscriber(sub.email)} className="text-slate-600 hover:text-red-500 font-bold text-xs uppercase tracking-widest transition-colors">Purge</button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={4} className="px-4 sm:px-8 py-10 sm:py-12 text-center text-slate-600 italic">
                         <div className="mb-2 text-2xl">🕸️</div>
                         Database is empty. Waiting for targets.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ROW 2: PENDING REVIEW */}
        <div className="lg:col-span-12 order-1">
          <div className="bg-slate-900 rounded-[2.5rem] border border-amber-500/30 overflow-hidden">
            <div className="p-8 border-b border-slate-800 bg-slate-900 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-white">Pending Review</h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-2">
                  {pendingJobs.length} waiting
                </p>
              </div>
              <span className="px-3 py-2 rounded-full text-[9px] font-black uppercase tracking-widest text-amber-300 border border-amber-600/40 bg-amber-600/10">
                Needs approval
              </span>
            </div>
            <div className="p-4 bg-[#0B1120]">
              {pendingJobs.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {pendingJobs.map((job) => (
                    <React.Fragment key={job.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedJobId((prev) => (prev === job.id ? null : job.id))}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        setExpandedJobId((prev) => (prev === job.id ? null : job.id));
                      }}
                      className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-col gap-4 group hover:border-indigo-500/50 transition-all cursor-pointer"
                    >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-lg">
                        {job.planType === 'Elite Managed' ? '💎' : '💼'}
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm line-clamp-1 group-hover:text-indigo-400 transition-colors">{job.title}</h4>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">{job.company}</p>
                        <p className="text-[10px] text-slate-600 uppercase tracking-wider">
                          {getRemainingDays(job) === null ? "Expiry N/A" : `Expires in ${getRemainingDays(job)} days`}
                        </p>
                      </div>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border border-amber-600/40 text-amber-300 bg-amber-600/10">
                      pending
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        updateJobStatus(job.id, "published");
                      }}
                      className="flex-1 bg-emerald-600/20 text-emerald-300 border border-emerald-600/40 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600/30"
                    >
                      Accept
                    </button>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        updateJobStatus(job.id, "private");
                      }}
                      className="flex-1 bg-red-600/10 text-red-400 border border-red-600/30 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest hover:bg-red-600/20"
                    >
                      Decline
                    </button>
                  </div>
                </div>
                  {expandedJobId === job.id && (
                    <div className="sm:col-span-2 xl:col-span-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-5 text-xs text-slate-300 space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            updateJobStatus(job.id, "published");
                          }}
                          className="flex-1 bg-emerald-600/20 text-emerald-300 border border-emerald-600/40 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600/30"
                        >
                          Accept
                        </button>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            updateJobStatus(job.id, "private");
                          }}
                          className="flex-1 bg-red-600/10 text-red-400 border border-red-600/30 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest hover:bg-red-600/20"
                        >
                          Decline
                        </button>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Description</p>
                        {editingJobId === job.id && editDraft ? (
                          <textarea
                            value={editDraft.description}
                            onChange={(event) => setEditDraft({ ...editDraft, description: event.target.value })}
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                            className="mt-2 w-full min-h-[160px] rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                          />
                        ) : (
                          <p className="mt-2 text-slate-300 whitespace-pre-wrap max-h-56 overflow-y-auto pr-2 custom-scrollbar">
                            {job.description || "No description provided."}
                          </p>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <p>
                          <span className="text-slate-500 font-bold">Title:</span>{" "}
                          {editingJobId === job.id && editDraft ? (
                            <input
                              value={editDraft.title}
                              onChange={(event) => setEditDraft({ ...editDraft, title: event.target.value })}
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => event.stopPropagation()}
                              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1 text-xs text-slate-200"
                            />
                          ) : (
                            job.title || "N/A"
                          )}
                        </p>
                        <p>
                          <span className="text-slate-500 font-bold">Location:</span>{" "}
                          {editingJobId === job.id && editDraft ? (
                            <input
                              value={editDraft.location}
                              onChange={(event) => setEditDraft({ ...editDraft, location: event.target.value })}
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => event.stopPropagation()}
                              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1 text-xs text-slate-200"
                            />
                          ) : (
                            job.location || "N/A"
                          )}
                        </p>
                        <p>
                          <span className="text-slate-500 font-bold">Remote policy:</span>{" "}
                          {editingJobId === job.id && editDraft ? (
                            <input
                              value={editDraft.remotePolicy}
                              onChange={(event) => setEditDraft({ ...editDraft, remotePolicy: event.target.value })}
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => event.stopPropagation()}
                              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1 text-xs text-slate-200"
                            />
                          ) : (
                            job.remotePolicy || "N/A"
                          )}
                        </p>
                        <p>
                          <span className="text-slate-500 font-bold">Type:</span>{" "}
                          {editingJobId === job.id && editDraft ? (
                            <input
                              value={editDraft.type}
                              onChange={(event) => setEditDraft({ ...editDraft, type: event.target.value })}
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => event.stopPropagation()}
                              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1 text-xs text-slate-200"
                            />
                          ) : (
                            job.type || "N/A"
                          )}
                        </p>
                        <p>
                          <span className="text-slate-500 font-bold">Salary:</span>{" "}
                          {editingJobId === job.id && editDraft ? (
                            <input
                              value={editDraft.salary}
                              onChange={(event) => setEditDraft({ ...editDraft, salary: event.target.value })}
                              onClick={(event) => event.stopPropagation()}
                              onKeyDown={(event) => event.stopPropagation()}
                              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1 text-xs text-slate-200"
                            />
                          ) : (
                            job.salary || "N/A"
                          )}
                        </p>
                        <p><span className="text-slate-500 font-bold">Apply URL:</span> {job.applyUrl || "N/A"}</p>
                        <p><span className="text-slate-500 font-bold">Company website:</span> {job.companyWebsite || "N/A"}</p>
                        <p><span className="text-slate-500 font-bold">Keywords:</span> {job.keywords || "N/A"}</p>
                        <p><span className="text-slate-500 font-bold">Posted:</span> {formatDate(job.timestamp)}</p>
                        <p><span className="text-slate-500 font-bold">Plan duration:</span> {getPlanDurationDays(job)} days</p>
                        <p><span className="text-slate-500 font-bold">Expires:</span> {getExpiryDate(job)}</p>
                        <p><span className="text-slate-500 font-bold">Days left:</span> {getRemainingDays(job) ?? "N/A"}</p>
                      </div>
                      {job.tags?.length ? (
                        <div className="flex flex-wrap gap-2">
                          {job.tags.map((tag) => (
                            <span key={tag} className="px-2 py-1 rounded-lg bg-slate-800 text-slate-200 text-[10px] font-black uppercase tracking-widest">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        {editingJobId === job.id ? (
                          <>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                saveJobEdits(job.id);
                              }}
                              className="flex-1 bg-indigo-600/20 text-indigo-300 border border-indigo-600/40 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600/30"
                            >
                              Save changes
                            </button>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                cancelEditJob();
                              }}
                              className="flex-1 bg-slate-950 text-slate-400 border border-slate-800 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest hover:text-white"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              startEditJob(job);
                            }}
                            className="w-full bg-slate-950 text-slate-400 border border-slate-800 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest hover:text-indigo-300"
                          >
                            Edit text
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                    </React.Fragment>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-slate-600 text-sm italic">
                  Nothing to review right now.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ROW 2: ACTIVE JOBS */}
        <div className="lg:col-span-6 order-2">
          <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 overflow-hidden h-full flex flex-col">
            <div className="p-8 border-b border-slate-800 bg-slate-900">
              <h3 className="text-lg font-black text-white">Active Deployments</h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-2">
                {activeJobs.length} active · {archivedJobs.length} archived
              </p>
            </div>
            <div className="p-4 flex-1 overflow-y-auto custom-scrollbar bg-[#0B1120]">
              {activeJobs.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {activeJobs.map(job => (
                    <div
                      key={job.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedJobId((prev) => (prev === job.id ? null : job.id))}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        setExpandedJobId((prev) => (prev === job.id ? null : job.id));
                      }}
                      className={`bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-col gap-4 group hover:border-indigo-500/50 transition-all cursor-pointer ${
                        expandedJobId === job.id ? "sm:col-span-2 xl:col-span-3" : ""
                      }`}
                    >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-lg">
                          {job.planType === 'Elite Managed' ? '💎' : '💼'}
                       </div>
                       <div>
                          <h4 className="font-bold text-white text-sm line-clamp-1 group-hover:text-indigo-400 transition-colors">{job.title}</h4>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider">{job.company}</p>
                          <p className="text-[10px] text-slate-600 uppercase tracking-wider">
                            {getRemainingDays(job) === null ? "Expiry N/A" : `Expires in ${getRemainingDays(job)} days`}
                          </p>
                       </div>
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border border-slate-700 text-slate-400">
                      {job.status || "draft"}
                    </span>
                  </div>
                  {job.stripePaymentStatus === "paid" && job.status !== "published" && (
                    <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-emerald-300">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      Paid · Awaiting Accept
                    </div>
                  )}
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      setExpandedJobId((prev) => (prev === job.id ? null : job.id));
                    }}
                    className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-300 text-left"
                  >
                    {expandedJobId === job.id ? "Hide details" : "View details"}
                  </button>
                  {expandedJobId === job.id && (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-xs text-slate-300 space-y-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Description</p>
                        {editingJobId === job.id && editDraft ? (
                          <textarea
                            value={editDraft.description}
                            onChange={(event) => setEditDraft({ ...editDraft, description: event.target.value })}
                                onClick={(event) => event.stopPropagation()}
                                onKeyDown={(event) => event.stopPropagation()}
                            className="mt-2 w-full min-h-[120px] rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                          />
                        ) : (
                          <p className="mt-2 text-slate-300 whitespace-pre-wrap max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                            {job.description || "No description provided."}
                          </p>
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        <p>
                          <span className="text-slate-500 font-bold">Title:</span>{" "}
                          {editingJobId === job.id && editDraft ? (
                            <input
                              value={editDraft.title}
                              onChange={(event) => setEditDraft({ ...editDraft, title: event.target.value })}
                                  onClick={(event) => event.stopPropagation()}
                                  onKeyDown={(event) => event.stopPropagation()}
                              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1 text-xs text-slate-200"
                            />
                          ) : (
                            job.title || "N/A"
                          )}
                        </p>
                        <p>
                          <span className="text-slate-500 font-bold">Location:</span>{" "}
                          {editingJobId === job.id && editDraft ? (
                            <input
                              value={editDraft.location}
                              onChange={(event) => setEditDraft({ ...editDraft, location: event.target.value })}
                                  onClick={(event) => event.stopPropagation()}
                                  onKeyDown={(event) => event.stopPropagation()}
                              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1 text-xs text-slate-200"
                            />
                          ) : (
                            job.location || "N/A"
                          )}
                        </p>
                        <p>
                          <span className="text-slate-500 font-bold">Remote policy:</span>{" "}
                          {editingJobId === job.id && editDraft ? (
                            <input
                              value={editDraft.remotePolicy}
                              onChange={(event) => setEditDraft({ ...editDraft, remotePolicy: event.target.value })}
                                  onClick={(event) => event.stopPropagation()}
                                  onKeyDown={(event) => event.stopPropagation()}
                              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1 text-xs text-slate-200"
                            />
                          ) : (
                            job.remotePolicy || "N/A"
                          )}
                        </p>
                        <p>
                          <span className="text-slate-500 font-bold">Type:</span>{" "}
                          {editingJobId === job.id && editDraft ? (
                            <input
                              value={editDraft.type}
                              onChange={(event) => setEditDraft({ ...editDraft, type: event.target.value })}
                                  onClick={(event) => event.stopPropagation()}
                                  onKeyDown={(event) => event.stopPropagation()}
                              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1 text-xs text-slate-200"
                            />
                          ) : (
                            job.type || "N/A"
                          )}
                        </p>
                        <p>
                          <span className="text-slate-500 font-bold">Salary:</span>{" "}
                          {editingJobId === job.id && editDraft ? (
                            <input
                              value={editDraft.salary}
                              onChange={(event) => setEditDraft({ ...editDraft, salary: event.target.value })}
                                  onClick={(event) => event.stopPropagation()}
                                  onKeyDown={(event) => event.stopPropagation()}
                              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1 text-xs text-slate-200"
                            />
                          ) : (
                            job.salary || "N/A"
                          )}
                        </p>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        <p><span className="text-slate-500 font-bold">Apply URL:</span> {job.applyUrl || "N/A"}</p>
                        <p><span className="text-slate-500 font-bold">Company website:</span> {job.companyWebsite || "N/A"}</p>
                        <p><span className="text-slate-500 font-bold">Keywords:</span> {job.keywords || "N/A"}</p>
                        <p><span className="text-slate-500 font-bold">Posted:</span> {formatDate(job.timestamp)}</p>
                        <p><span className="text-slate-500 font-bold">Plan duration:</span> {getPlanDurationDays(job)} days</p>
                        <p><span className="text-slate-500 font-bold">Expires:</span> {getExpiryDate(job)}</p>
                        <p><span className="text-slate-500 font-bold">Days left:</span> {getRemainingDays(job) ?? "N/A"}</p>
                      </div>
                      {job.tags?.length ? (
                        <div className="flex flex-wrap gap-2">
                          {job.tags.map((tag) => (
                            <span key={tag} className="px-2 py-1 rounded-lg bg-slate-800 text-slate-200 text-[10px] font-black uppercase tracking-widest">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        {editingJobId === job.id ? (
                          <>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                saveJobEdits(job.id);
                              }}
                              className="flex-1 bg-indigo-600/20 text-indigo-300 border border-indigo-600/40 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600/30"
                            >
                              Save changes
                            </button>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                cancelEditJob();
                              }}
                              className="flex-1 bg-slate-950 text-slate-400 border border-slate-800 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest hover:text-white"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              startEditJob(job);
                            }}
                            className="w-full bg-slate-950 text-slate-400 border border-slate-800 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest hover:text-indigo-300"
                          >
                            Edit text
                          </button>
                        )}
                      </div>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteJob(job.id);
                        }}
                        className="w-full bg-red-600/10 text-red-400 border border-red-600/30 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest hover:bg-red-600/20"
                      >
                        Delete job
                      </button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    {job.stripePaymentStatus === "paid" && job.status !== "published" && (
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          updateJobStatus(job.id, "published");
                        }}
                        className="flex-1 bg-emerald-600/20 text-emerald-300 border border-emerald-600/40 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600/30"
                      >
                        Accept
                      </button>
                    )}
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          updateJobStatus(job.id, "private");
                        }}
                        className={`${
                        job.stripePaymentStatus === "paid" && job.status !== "published" ? "flex-1" : "w-full"
                      } bg-slate-950 text-slate-500 border border-slate-800 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest hover:text-red-400 hover:border-red-600/40`}
                    >
                      Archive
                    </button>
                  </div>
                </div>
                  ))}
                </div>
              ) : (
                 <div className="h-full flex flex-col items-center justify-center text-slate-600 text-sm italic">
                    <p>No active ops deployed.</p>
                 </div>
              )}
            </div>
          </div>
        </div>

        {/* ROW 2: ARCHIVED JOBS */}
        <div className="lg:col-span-6 order-3">
          <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 overflow-hidden h-full flex flex-col">
            <div className="p-8 border-b border-slate-800 bg-slate-900">
              <h3 className="text-lg font-black text-white">Archived Jobs</h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-2">
                {archivedJobs.length} archived
              </p>
            </div>
            <div className="p-4 flex-1 overflow-y-auto custom-scrollbar bg-[#0B1120]">
              {archivedJobs.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {archivedJobs.map((job) => (
                    <div
                      key={job.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedJobId((prev) => (prev === job.id ? null : job.id))}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        setExpandedJobId((prev) => (prev === job.id ? null : job.id));
                      }}
                      className={`bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-col gap-4 group hover:border-indigo-500/50 transition-all cursor-pointer ${
                        expandedJobId === job.id ? "sm:col-span-2 xl:col-span-3" : ""
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-lg">
                            {job.planType === "Elite Managed" ? "💎" : "💼"}
                          </div>
                          <div>
                            <h4 className="font-bold text-white text-sm line-clamp-1 group-hover:text-indigo-400 transition-colors">{job.title}</h4>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">{job.company}</p>
                            <p className="text-[10px] text-slate-600 uppercase tracking-wider">
                              {getRemainingDays(job) === null ? "Expiry N/A" : `Expires in ${getRemainingDays(job)} days`}
                            </p>
                          </div>
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded border border-slate-700 text-slate-400">
                          archived
                        </span>
                      </div>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          setExpandedJobId((prev) => (prev === job.id ? null : job.id));
                        }}
                        className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-300 text-left"
                      >
                        {expandedJobId === job.id ? "Hide details" : "View details"}
                      </button>
                      {expandedJobId === job.id && (
                        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-xs text-slate-300 space-y-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Description</p>
                            {editingJobId === job.id && editDraft ? (
                              <textarea
                                value={editDraft.description}
                                onChange={(event) => setEditDraft({ ...editDraft, description: event.target.value })}
                                onClick={(event) => event.stopPropagation()}
                                onKeyDown={(event) => event.stopPropagation()}
                                className="mt-2 w-full min-h-[120px] rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                              />
                            ) : (
                              <p className="mt-2 text-slate-300 whitespace-pre-wrap max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                {job.description || "No description provided."}
                              </p>
                            )}
                          </div>
                          <div className="grid grid-cols-1 gap-2">
                            <p>
                              <span className="text-slate-500 font-bold">Title:</span>{" "}
                              {editingJobId === job.id && editDraft ? (
                                <input
                                  value={editDraft.title}
                                  onChange={(event) => setEditDraft({ ...editDraft, title: event.target.value })}
                                  onClick={(event) => event.stopPropagation()}
                                  onKeyDown={(event) => event.stopPropagation()}
                                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1 text-xs text-slate-200"
                                />
                              ) : (
                                job.title || "N/A"
                              )}
                            </p>
                            <p>
                              <span className="text-slate-500 font-bold">Location:</span>{" "}
                              {editingJobId === job.id && editDraft ? (
                                <input
                                  value={editDraft.location}
                                  onChange={(event) => setEditDraft({ ...editDraft, location: event.target.value })}
                                  onClick={(event) => event.stopPropagation()}
                                  onKeyDown={(event) => event.stopPropagation()}
                                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1 text-xs text-slate-200"
                                />
                              ) : (
                                job.location || "N/A"
                              )}
                            </p>
                            <p>
                              <span className="text-slate-500 font-bold">Remote policy:</span>{" "}
                              {editingJobId === job.id && editDraft ? (
                                <input
                                  value={editDraft.remotePolicy}
                                  onChange={(event) => setEditDraft({ ...editDraft, remotePolicy: event.target.value })}
                                  onClick={(event) => event.stopPropagation()}
                                  onKeyDown={(event) => event.stopPropagation()}
                                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1 text-xs text-slate-200"
                                />
                              ) : (
                                job.remotePolicy || "N/A"
                              )}
                            </p>
                            <p>
                              <span className="text-slate-500 font-bold">Type:</span>{" "}
                              {editingJobId === job.id && editDraft ? (
                                <input
                                  value={editDraft.type}
                                  onChange={(event) => setEditDraft({ ...editDraft, type: event.target.value })}
                                  onClick={(event) => event.stopPropagation()}
                                  onKeyDown={(event) => event.stopPropagation()}
                                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1 text-xs text-slate-200"
                                />
                              ) : (
                                job.type || "N/A"
                              )}
                            </p>
                            <p>
                              <span className="text-slate-500 font-bold">Salary:</span>{" "}
                              {editingJobId === job.id && editDraft ? (
                                <input
                                  value={editDraft.salary}
                                  onChange={(event) => setEditDraft({ ...editDraft, salary: event.target.value })}
                                  onClick={(event) => event.stopPropagation()}
                                  onKeyDown={(event) => event.stopPropagation()}
                                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-1 text-xs text-slate-200"
                                />
                              ) : (
                                job.salary || "N/A"
                              )}
                            </p>
                          </div>
                          <div className="grid grid-cols-1 gap-2">
                            <p><span className="text-slate-500 font-bold">Apply URL:</span> {job.applyUrl || "N/A"}</p>
                            <p><span className="text-slate-500 font-bold">Company website:</span> {job.companyWebsite || "N/A"}</p>
                            <p><span className="text-slate-500 font-bold">Keywords:</span> {job.keywords || "N/A"}</p>
                            <p><span className="text-slate-500 font-bold">Posted:</span> {formatDate(job.timestamp)}</p>
                            <p><span className="text-slate-500 font-bold">Plan duration:</span> {getPlanDurationDays(job)} days</p>
                            <p><span className="text-slate-500 font-bold">Expires:</span> {getExpiryDate(job)}</p>
                            <p><span className="text-slate-500 font-bold">Days left:</span> {getRemainingDays(job) ?? "N/A"}</p>
                          </div>
                          {job.tags?.length ? (
                            <div className="flex flex-wrap gap-2">
                              {job.tags.map((tag) => (
                                <span key={tag} className="px-2 py-1 rounded-lg bg-slate-800 text-slate-200 text-[10px] font-black uppercase tracking-widest">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          <div className="flex flex-wrap gap-2">
                            {editingJobId === job.id ? (
                              <>
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    saveJobEdits(job.id);
                                  }}
                                  className="flex-1 bg-indigo-600/20 text-indigo-300 border border-indigo-600/40 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600/30"
                                >
                                  Save changes
                                </button>
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    cancelEditJob();
                                  }}
                                  className="flex-1 bg-slate-950 text-slate-400 border border-slate-800 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest hover:text-white"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  startEditJob(job);
                                }}
                                className="w-full bg-slate-950 text-slate-400 border border-slate-800 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest hover:text-indigo-300"
                              >
                                Edit text
                              </button>
                            )}
                          </div>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDeleteJob(job.id);
                            }}
                            className="w-full bg-red-600/10 text-red-400 border border-red-600/30 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest hover:bg-red-600/20"
                          >
                            Delete job
                          </button>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            updateJobStatus(job.id, "published");
                          }}
                          className="flex-1 bg-indigo-600/20 text-indigo-300 border border-indigo-600/40 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600/30"
                        >
                          Restore
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 text-sm italic">
                  <p>No archived jobs.</p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="lg:col-span-12 text-center pt-8 pb-4">
           <p className="text-[10px] font-mono text-slate-600 uppercase tracking-[0.2em]">
              CareersPal Internal System v2.4.0 • Level 0 Clearance Required
           </p>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
