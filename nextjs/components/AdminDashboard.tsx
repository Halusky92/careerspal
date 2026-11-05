"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Subscriber } from "../services/notificationService";
import { Job } from "../types";
import { useSupabaseAuth } from "./Providers";
import { authFetch } from "../lib/authFetch";
import { formatSalaryDisplay } from "../lib/formatSalary";
import { formatShortPostedDate } from "../lib/formatPosted";
import SourcingRegistrySection from "./admin/SourcingRegistrySection";
import AdminPeopleTab from "./AdminPeopleTab";
import JobViewCount from "./JobViewCount";
import ListingPlanBadge from "./ListingPlanBadge";
import { countCompanyPackUsage } from "../lib/listingPlan";

type AnalyticsPeriod = {
  totalViews: number;
  uniqueVisitors: number;
  newVisitors: number;
  returningVisitors: number;
};

type AnalyticsPageRow = { path: string; label: string; views: number };

type AnalyticsPayload = {
  periods: {
    today: AnalyticsPeriod;
    week: AnalyticsPeriod;
    month: AnalyticsPeriod;
    all: AnalyticsPeriod;
  };
  pages?: {
    today: AnalyticsPageRow[];
    week: AnalyticsPageRow[];
    month: AnalyticsPageRow[];
  };
};

interface AdminDashboardProps {
  onLogout: () => void;
}

type AdminTab = "review" | "jobs" | "people" | "sourcing" | "more";

const getLocalJson = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const statusLabel = (status?: string) => {
  switch (status) {
    case "published":
      return "Live";
    case "pending_review":
      return "Needs review";
    case "paused":
      return "Paused";
    case "closed":
      return "Closed";
    case "archived":
    case "private":
      return "Archived";
    case "draft":
      return "Draft";
    default:
      return status || "Draft";
  }
};

const statusTone = (status?: string) => {
  switch (status) {
    case "published":
      return "text-emerald-700 bg-emerald-50";
    case "pending_review":
      return "text-amber-800 bg-amber-50";
    case "paused":
      return "text-amber-700 bg-amber-50";
    default:
      return "text-slate-600 bg-slate-100";
  }
};

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [jobs, setJobs] = useState<Job[]>(() => getLocalJson<Job[]>("cp_my_jobs", []));
  const [adminStats, setAdminStats] = useState({ users: 0, jobs: 0, savedJobs: 0, files: 0 });
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [jobQuery, setJobQuery] = useState("");
  const [showJobSuggestions, setShowJobSuggestions] = useState(false);
  const [jobSort, setJobSort] = useState<"newest" | "oldest">("newest");
  const [jobFilter, setJobFilter] = useState<"all" | "live" | "review" | "draft" | "archived">("live");
  const [tab, setTab] = useState<AdminTab>("review");
  const searchParams = useSearchParams();
  const jobSearchRef = useRef<HTMLDivElement>(null);
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [autoReviewBusy, setAutoReviewBusy] = useState(false);
  const { accessToken } = useSupabaseAuth();
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    title: string;
    description: string;
    location: string;
    remotePolicy: string;
    type: string;
    salary: string;
    applyUrl: string;
  } | null>(null);
  const [showAdminCreate, setShowAdminCreate] = useState(false);
  const [adminCreateStatus, setAdminCreateStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [adminCreateMsg, setAdminCreateMsg] = useState("");
  const [jobActionTone, setJobActionTone] = useState<"idle" | "success" | "error">("idle");
  const [jobActionMsg, setJobActionMsg] = useState("");
  const [showOlderLive, setShowOlderLive] = useState(false);
  const [cmd, setCmd] = useState("");
  const [adminCreateDraft, setAdminCreateDraft] = useState({
    title: "",
    company: "",
    applyUrl: "",
    companyWebsite: "",
    logo: "",
    location: "Remote",
    remotePolicy: "Remote (Global)",
    type: "Full-time" as Job["type"],
    category: "Operations",
    salary: "",
    description: "",
    tagsCsv: "",
    toolsCsv: "",
    status: "published" as "published" | "pending_review" | "draft" | "private",
    planType: "Standard" as "Standard" | "Featured Pro" | "Elite Managed",
    isFeatured: false,
  });

  const formatDate = (value?: number) => {
    if (!value) return "—";
    return formatShortPostedDate(value) || "—";
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
      applyUrl: job.applyUrl || "",
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
      if (data.job) setJobs((prev) => prev.map((j) => (j.id === id ? data.job! : j)));
      cancelEditJob();
    } catch {
      // noop
    }
  };

  const adminCreateJob = async () => {
    if (!accessToken) return;
    if (!adminCreateDraft.title.trim() || !adminCreateDraft.company.trim() || !adminCreateDraft.applyUrl.trim()) {
      setAdminCreateStatus("error");
      setAdminCreateMsg("Need title, company, and apply URL.");
      return;
    }
    setAdminCreateStatus("saving");
    setAdminCreateMsg("");
    try {
      const response = await authFetch(
        "/api/admin/jobs",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(adminCreateDraft),
        },
        accessToken,
      );
      const payload = (await response.json()) as { job?: Job; error?: string };
      if (!response.ok || !payload.job) {
        setAdminCreateStatus("error");
        setAdminCreateMsg(payload.error || "Failed to create job.");
        return;
      }
      setJobs((prev) => [payload.job!, ...prev]);
      setAdminCreateStatus("success");
      setAdminCreateMsg("Job created.");
      setShowAdminCreate(false);
      setAdminCreateDraft((prev) => ({
        ...prev,
        title: "",
        company: "",
        applyUrl: "",
        companyWebsite: "",
        logo: "",
        salary: "",
        description: "",
        tagsCsv: "",
        toolsCsv: "",
        status: "published",
        planType: "Standard",
        isFeatured: false,
      }));
    } catch {
      setAdminCreateStatus("error");
      setAdminCreateMsg("Failed to create job.");
    }
  };

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
      if (!accessToken) return;
      try {
        const response = await authFetch("/api/admin/stats", {}, accessToken);
        const data = (await response.json()) as { users?: number; jobs?: number; savedJobs?: number; files?: number };
        setAdminStats({
          users: data.users || 0,
          jobs: data.jobs || 0,
          savedJobs: data.savedJobs || 0,
          files: data.files || 0,
        });
      } catch {
        // noop
      }
    };
    loadAdminStats();
  }, [accessToken]);

  useEffect(() => {
    const next = searchParams.get("tab");
    if (next === "team" || next === "people") {
      setTab("people");
      return;
    }
    if (next === "traffic" || next === "more") {
      setTab("more");
      return;
    }
    if (next === "review" || next === "jobs" || next === "sourcing") {
      setTab(next);
    }
  }, [searchParams]);

  useEffect(() => {
    const loadSubscribers = async () => {
      if (!accessToken) return;
      try {
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
      if (!accessToken) return;
      try {
        const response = await authFetch("/api/admin/analytics", {}, accessToken);
        if (!response.ok) return;
        setAnalytics((await response.json()) as AnalyticsPayload);
      } catch {
        // noop
      }
    };
    loadAnalytics();
  }, [accessToken]);

  useEffect(() => {
    const loadJobs = async () => {
      if (!accessToken) return;
      try {
        const response = await authFetch("/api/admin/jobs", {}, accessToken);
        if (!response.ok) return;
        const data = (await response.json()) as { jobs?: Job[] };
        if (data.jobs) setJobs(data.jobs);
      } catch {
        // fallback to local storage
      }
    };
    loadJobs();
  }, [accessToken]);

  const updateJobStatus = async (id: string, status: string) => {
    if (!accessToken) return;
    try {
      const response = await authFetch(
        `/api/admin/jobs/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
        accessToken,
      );
      const data = (await response.json()) as { job?: Job; error?: string };
      if (!response.ok) {
        setJobActionTone("error");
        setJobActionMsg(data.error || "Action failed.");
        return;
      }
      setJobs((prev) =>
        prev.map((j) => (j.id === id ? { ...j, ...(data.job || {}), status: data.job?.status || status } : j)),
      );
      setJobActionTone("success");
      setJobActionMsg(status === "published" ? "On the board." : status === "private" ? "Declined." : "Updated.");
    } catch {
      setJobActionTone("error");
      setJobActionMsg("Action failed.");
    }
  };

  const runAutoReview = async () => {
    if (!accessToken) return;
    setAutoReviewBusy(true);
    try {
      const response = await authFetch("/api/admin/jobs/auto-review", { method: "POST" }, accessToken);
      const data = (await response.json()) as { published?: number; held?: number; scanned?: number; error?: string };
      if (!response.ok) {
        setJobActionTone("error");
        setJobActionMsg(data.error || "Auto-check failed.");
        return;
      }
      const jobsResp = await authFetch("/api/admin/jobs", {}, accessToken);
      if (jobsResp.ok) {
        const payload = (await jobsResp.json()) as { jobs?: Job[] };
        if (payload.jobs) setJobs(payload.jobs);
      }
      setJobActionTone("success");
      setJobActionMsg(
        `Auto-check: ${data.published ?? 0} published, ${data.held ?? 0} still need you (${data.scanned ?? 0} scanned).`,
      );
    } catch {
      setJobActionTone("error");
      setJobActionMsg("Auto-check failed.");
    } finally {
      setAutoReviewBusy(false);
    }
  };

  const handleDeleteJob = async (id: string) => {
    if (!accessToken) return;
    if (!confirm("Delete this job permanently?")) return;
    try {
      const response = await authFetch(`/api/admin/jobs/${id}`, { method: "DELETE" }, accessToken);
      if (!response.ok) return;
      setJobs((prev) => prev.filter((job) => job.id !== id));
      setExpandedJobId((prev) => (prev === id ? null : prev));
    } catch {
      // noop
    }
  };

  const handleDeleteSubscriber = async (email: string) => {
    if (!accessToken) return;
    if (!confirm(`Remove ${email} from the alert list?`)) return;
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
    return jobs.filter((job) => (job.title || "").toLowerCase().includes(query) || (job.company || "").toLowerCase().includes(query));
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
    if (!jobQuery.trim()) return [];
    const lowQuery = jobQuery.toLowerCase();
    const titles = jobs.filter((j) => j.title?.toLowerCase().includes(lowQuery)).map((j) => j.title);
    return Array.from(new Set(titles)).slice(0, 6);
  }, [jobQuery, jobs]);

  const packUsedByCompany = useMemo(() => countCompanyPackUsage(jobs), [jobs]);

  const pendingJobs = useMemo(
    () => sortedJobs.filter((job) => job.status === "pending_review"),
    [sortedJobs],
  );
  const liveJobs = useMemo(
    () => sortedJobs.filter((job) => job.status === "published"),
    [sortedJobs],
  );
  const liveNewest = liveJobs.slice(0, 3);
  const liveOlder = liveJobs.slice(3);
  const listedJobs = useMemo(() => {
    if (jobFilter === "live") return liveJobs;
    if (jobFilter === "review") return pendingJobs;
    if (jobFilter === "draft") return sortedJobs.filter((job) => job.status === "draft");
    if (jobFilter === "archived") return sortedJobs.filter((job) => job.status === "private" || job.status === "archived" || job.status === "closed");
    return sortedJobs;
  }, [sortedJobs, jobFilter, liveJobs, pendingJobs]);

  const runCommand = () => {
    const raw = cmd.trim();
    const q = raw.toLowerCase();
    if (!q) return;
    if (q === "auto" || q === "auto-check") {
      void runAutoReview();
      setCmd("");
      return;
    }
    if (q === "review" || q === "confirm") {
      setTab("review");
      setCmd("");
      return;
    }
    setJobQuery(raw);
    setTab("jobs");
    setShowJobSuggestions(false);
  };


  const fieldClass = "cp-field w-full rounded-lg px-3 py-2 text-sm";
  const labelClass = "text-xs font-medium text-slate-500";

  const renderJobRow = (job: Job, mode: "review" | "jobs") => {
    const open = expandedJobId === job.id;
    return (
      <React.Fragment key={job.id}>
        <tr className="border-b border-slate-100 last:border-0">
          <td className="pl-3 pr-1 py-2.5 w-24">
            {job.status === "pending_review" || mode === "review" ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title="Publish"
                  aria-label="Publish"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateJobStatus(job.id, "published");
                  }}
                  className="h-9 w-9 rounded-lg bg-emerald-600 text-white text-lg font-semibold leading-none hover:bg-emerald-700"
                >
                  ✓
                </button>
                <button
                  type="button"
                  title="Delete"
                  aria-label="Delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteJob(job.id);
                  }}
                  className="h-9 w-9 rounded-lg bg-rose-600 text-white text-lg font-semibold leading-none hover:bg-rose-700"
                >
                  ✕
                </button>
              </div>
            ) : null}
          </td>
          <td className="px-4 py-2.5">
            <button type="button" className="text-left font-medium text-slate-900 line-clamp-2 hover:text-indigo-700" onClick={() => setExpandedJobId(open ? null : job.id)}>
              {job.title}
            </button>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <ListingPlanBadge job={job} packUsedByCompany={packUsedByCompany} />
              <span className="text-xs text-slate-500">
                <span className="sm:hidden">{job.company} · </span>
                <JobViewCount views={job.views} forOwner />
              </span>
            </div>
          </td>
          <td className="px-3 py-2.5 text-slate-600 hidden sm:table-cell whitespace-nowrap">{job.company}</td>
          <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{formatSalaryDisplay(job.salary)}</td>
          {mode === "jobs" && (
            <td className="px-3 py-2.5">
              <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded ${statusTone(job.status)}`}>{statusLabel(job.status)}</span>
            </td>
          )}
          <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap hidden md:table-cell">{formatDate(job.timestamp)}</td>
          <td className="px-3 py-2.5 whitespace-nowrap text-right sticky right-0 bg-white shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.12)]">
            {mode === "review" || job.status === "pending_review" ? (
              <span className="text-xs text-slate-400">waiting</span>
            ) : (
              <div className="flex justify-end items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditJob(job);
                    setExpandedJobId(job.id);
                  }}
                  className="h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700"
                >
                  Edit
                </button>
                {job.status !== "published" ? (
                  <button
                    type="button"
                    title="Publish to the board"
                    aria-label="Publish"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateJobStatus(job.id, "published");
                    }}
                    className="h-9 w-9 rounded-lg bg-emerald-600 text-white text-lg font-semibold leading-none"
                  >
                    ✓
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateJobStatus(job.id, "private");
                    }}
                    className="h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600"
                  >
                    Archive
                  </button>
                )}
              </div>
            )}
          </td>
        </tr>
        {open && (
          <tr className="border-b border-slate-100 bg-slate-50/70">
            <td colSpan={mode === "jobs" ? 7 : 6} className="px-4 py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-700">
                <p>
                  <span className="text-slate-400">Apply</span>
                  <br />
                  {job.applyUrl ? (
                    <a href={job.applyUrl} target="_blank" rel="noreferrer" className="text-indigo-600 break-all">
                      {job.applyUrl}
                    </a>
                  ) : (
                    "—"
                  )}
                </p>
                <p>
                  <span className="text-slate-400">Location</span>
                  <br />
                  {job.location || "—"} · {job.remotePolicy || "—"}
                </p>
              </div>
              {editingJobId === job.id && editDraft ? (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input className={fieldClass} value={editDraft.title} onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })} />
                  <input className={fieldClass} value={editDraft.salary} onChange={(e) => setEditDraft({ ...editDraft, salary: e.target.value })} />
                  <input className={fieldClass} value={editDraft.location} onChange={(e) => setEditDraft({ ...editDraft, location: e.target.value })} />
                  <input className={fieldClass} value={editDraft.type} onChange={(e) => setEditDraft({ ...editDraft, type: e.target.value })} />
                  <textarea
                    className={`${fieldClass} sm:col-span-2 min-h-[100px]`}
                    value={editDraft.description}
                    onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
                  />
                  <button onClick={() => saveJobEdits(job.id)} className="h-9 rounded-lg bg-indigo-600 text-white text-sm font-medium">
                    Save
                  </button>
                  <button onClick={cancelEditJob} className="h-9 rounded-lg border border-slate-200 text-sm font-medium">
                    Cancel
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-600 line-clamp-4 whitespace-pre-wrap">{job.description || "No description."}</p>
              )}
              {mode === "jobs" && editingJobId !== job.id && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => startEditJob(job)} className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-medium">
                    Edit
                  </button>
                  {job.status !== "published" && (
                    <button onClick={() => updateJobStatus(job.id, "published")} className="h-8 px-3 rounded-lg bg-emerald-600 text-white text-xs font-medium">
                      Publish
                    </button>
                  )}
                  {job.status === "published" && (
                    <button onClick={() => updateJobStatus(job.id, "private")} className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-medium">
                      Archive
                    </button>
                  )}
                  <button onClick={() => handleDeleteJob(job.id)} className="h-8 px-3 rounded-lg text-xs font-medium text-rose-600">
                    Delete
                  </button>
                </div>
              )}
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  const tabs: { id: AdminTab; label: string; count?: number }[] = [
    { id: "review", label: "To confirm", count: pendingJobs.length },
    { id: "jobs", label: "Jobs", count: jobs.filter((j) => j.status === "published").length },
    { id: "people", label: "Team" },
    { id: "sourcing", label: "Pipeline" },
    { id: "more", label: "Traffic" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
      <div className="sticky top-14 z-30 mb-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 shadow-lg">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-sm font-medium text-emerald-300">Admin desk</p>
          <div className="flex items-center gap-2">
            <a href="/post-a-job?test=1" className="h-8 px-2.5 inline-flex items-center rounded-lg bg-amber-400 text-zinc-900 text-[11px] font-medium">
              $1 Stripe test
            </a>
            <span className="text-[11px] font-mono text-amber-300">{pendingJobs.length} waiting</span>
          </div>
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            runCommand();
          }}
        >
          <span className="text-emerald-400 font-mono text-sm shrink-0">$</span>
          <input
            value={cmd}
            onChange={(e) => setCmd(e.target.value)}
            placeholder="search / auto-check / review"
            className="flex-1 min-w-0 bg-transparent text-sm text-emerald-100 font-mono outline-none placeholder:text-zinc-500 h-9"
          />
          <button
            type="button"
            onClick={() => void runAutoReview()}
            disabled={autoReviewBusy}
            className="h-9 px-3 rounded-lg bg-emerald-700 text-white text-xs font-medium disabled:opacity-50"
          >
            {autoReviewBusy ? "…" : "Check"}
          </button>
        </form>
        <div className="mt-2 flex gap-1 overflow-x-auto">
          {tabs.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`h-8 px-3 rounded-lg text-xs font-medium whitespace-nowrap ${
                tab === item.id ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"
              }`}
            >
              {item.label}
              {typeof item.count === "number" ? ` ${item.count}` : ""}
            </button>
          ))}
        </div>
      </div>

      {jobActionMsg && (
        <div className={`mb-4 rounded-lg border px-3 py-2 text-sm ${jobActionTone === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
          {jobActionMsg}
        </div>
      )}

      {tab === "review" && (
        <div className="space-y-6">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900">Waiting for confirm</h2>
              <span className="text-xs text-amber-700">{pendingJobs.length}</span>
            </div>
            {pendingJobs.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center">
                <p className="font-medium text-slate-900">Nothing waiting</p>
                <p className="text-sm text-slate-500 mt-1">New employer submissions land here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingJobs.map((job) => (
                  <article key={job.id} className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 sm:p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          type="button"
                          title="Publish"
                          aria-label="Publish"
                          onClick={() => updateJobStatus(job.id, "published")}
                          className="h-10 w-10 rounded-lg bg-emerald-600 text-white text-xl font-semibold leading-none hover:bg-emerald-700"
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          aria-label="Delete"
                          onClick={() => handleDeleteJob(job.id)}
                          className="h-10 w-10 rounded-lg bg-rose-600 text-white text-xl font-semibold leading-none hover:bg-rose-700"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-slate-900">{job.title}</h3>
                          <ListingPlanBadge job={job} packUsedByCompany={packUsedByCompany} />
                        </div>
                        <p className="text-sm text-slate-500 mt-0.5">
                          {job.company} · {formatSalaryDisplay(job.salary)} · {job.location || "—"} · <JobViewCount views={job.views} forOwner />
                        </p>
                        <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap line-clamp-5">{job.description || "No description."}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                          {job.applyUrl ? (
                            <a href={job.applyUrl} target="_blank" rel="noreferrer" className="text-indigo-600 break-all">
                              {job.applyUrl}
                            </a>
                          ) : (
                            <span className="text-rose-600">No apply link</span>
                          )}
                          <button type="button" onClick={() => startEditJob(job)} className="text-slate-500 hover:text-slate-800">
                            Edit first
                          </button>
                        </div>
                        {editingJobId === job.id && editDraft ? (
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input className={fieldClass} value={editDraft.title} onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })} />
                            <input className={fieldClass} value={editDraft.salary} onChange={(e) => setEditDraft({ ...editDraft, salary: e.target.value })} />
                            <input className={fieldClass} value={editDraft.location} onChange={(e) => setEditDraft({ ...editDraft, location: e.target.value })} />
                            <input className={fieldClass} value={editDraft.applyUrl || job.applyUrl || ""} onChange={(e) => setEditDraft({ ...editDraft, applyUrl: e.target.value })} />
                            <textarea
                              className={`${fieldClass} sm:col-span-2 min-h-[100px]`}
                              value={editDraft.description}
                              onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
                            />
                            <button onClick={() => saveJobEdits(job.id)} className="h-9 rounded-lg bg-indigo-600 text-white text-sm font-medium">
                              Save
                            </button>
                            <button onClick={cancelEditJob} className="h-9 rounded-lg border border-slate-200 text-sm font-medium">
                              Cancel
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Live · 3 newest</h2>
            {liveNewest.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">No live listings yet.</div>
            ) : (
              liveNewest.map((job) => (
                <article key={job.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900">{job.title}</p>
                        <ListingPlanBadge job={job} packUsedByCompany={packUsedByCompany} />
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {job.company} · {formatSalaryDisplay(job.salary)} · <JobViewCount views={job.views} forOwner />
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteJob(job.id)}
                      className="h-9 px-3 rounded-lg text-xs font-medium text-rose-600"
                    >
                      Remove
                    </button>
                  </div>
                </article>
              ))
            )}
            {liveOlder.length > 0 ? (
              <details className="rounded-2xl border border-slate-200 bg-white">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-700">
                  Older live listings ({liveOlder.length})
                </summary>
                <div className="px-4 pb-4 space-y-2">
                  {liveOlder.map((job) => (
                    <div key={job.id} className="flex items-center justify-between gap-3 py-2 border-t border-slate-100">
                      <p className="min-w-0 truncate text-sm text-slate-800">
                        {job.title} · <ListingPlanBadge job={job} packUsedByCompany={packUsedByCompany} /> ·{" "}
                        <JobViewCount views={job.views} className="text-slate-500" forOwner />
                      </p>
                      <button type="button" onClick={() => handleDeleteJob(job.id)} className="text-xs text-rose-600">
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </section>
        </div>
      )}

      {tab === "jobs" && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <div ref={jobSearchRef} className="relative flex-1">
              <input
                value={jobQuery}
                onChange={(e) => {
                  setJobQuery(e.target.value);
                  setShowJobSuggestions(true);
                }}
                onFocus={() => setShowJobSuggestions(true)}
                placeholder="Search title or company"
                className={fieldClass}
              />
              {showJobSuggestions && jobSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 mt-1 rounded-lg border border-slate-200 bg-white shadow-lg z-20">
                  {jobSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                      onClick={() => {
                        setJobQuery(suggestion || "");
                        setShowJobSuggestions(false);
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => setShowAdminCreate((prev) => !prev)}
              className="h-10 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium"
            >
              {showAdminCreate ? "Close form" : "Add job"}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {(["live", "review", "draft", "archived", "all"] as const).map((id) => (
              <button
                key={id}
                onClick={() => setJobFilter(id)}
                className={`h-8 px-3 rounded-full text-xs font-medium ${jobFilter === id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
              >
                {id[0].toUpperCase() + id.slice(1)}
              </button>
            ))}
            <button
              onClick={() => setJobSort((prev) => (prev === "newest" ? "oldest" : "newest"))}
              className="h-8 px-3 rounded-full text-xs font-medium text-slate-500"
            >
              {jobSort === "newest" ? "Newest first" : "Oldest first"}
            </button>
          </div>

          {showAdminCreate && (
            <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <p className="text-sm font-medium text-slate-900">Add a listing</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Title</label>
                  <input className={fieldClass} value={adminCreateDraft.title} onChange={(e) => setAdminCreateDraft((p) => ({ ...p, title: e.target.value }))} />
                </div>
                <div>
                  <label className={labelClass}>Company</label>
                  <input className={fieldClass} value={adminCreateDraft.company} onChange={(e) => setAdminCreateDraft((p) => ({ ...p, company: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Apply URL</label>
                  <input className={fieldClass} value={adminCreateDraft.applyUrl} onChange={(e) => setAdminCreateDraft((p) => ({ ...p, applyUrl: e.target.value }))} />
                </div>
                <div>
                  <label className={labelClass}>Salary</label>
                  <input className={fieldClass} value={adminCreateDraft.salary} onChange={(e) => setAdminCreateDraft((p) => ({ ...p, salary: e.target.value }))} placeholder="$100k–$140k" />
                </div>
                <div>
                  <label className={labelClass}>Location</label>
                  <input className={fieldClass} value={adminCreateDraft.location} onChange={(e) => setAdminCreateDraft((p) => ({ ...p, location: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Description</label>
                  <textarea className={`${fieldClass} min-h-[100px]`} value={adminCreateDraft.description} onChange={(e) => setAdminCreateDraft((p) => ({ ...p, description: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={adminCreateJob} disabled={adminCreateStatus === "saving"} className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-60">
                  {adminCreateStatus === "saving" ? "Creating…" : "Create"}
                </button>
                <button onClick={() => setShowAdminCreate(false)} className="h-9 px-4 rounded-lg border border-slate-200 text-sm font-medium">
                  Cancel
                </button>
              </div>
              {adminCreateMsg && <p className={`text-sm ${adminCreateStatus === "error" ? "text-rose-600" : "text-emerald-700"}`}>{adminCreateMsg}</p>}
            </div>
          )}

          <div className="space-y-3">
            {listedJobs.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">No jobs in this filter.</div>
            ) : (
              (jobFilter === "live" && !showOlderLive ? listedJobs.slice(0, 3) : listedJobs).map((job) => (
                <article key={job.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start gap-3">
                    {job.status === "pending_review" ? (
                      <div className="flex flex-col gap-1 shrink-0">
                        <button type="button" onClick={() => updateJobStatus(job.id, "published")} className="h-9 w-9 rounded-lg bg-emerald-600 text-white">✓</button>
                        <button type="button" onClick={() => handleDeleteJob(job.id)} className="h-9 w-9 rounded-lg bg-rose-600 text-white">✕</button>
                      </div>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900">{job.title}</p>
                        <ListingPlanBadge job={job} packUsedByCompany={packUsedByCompany} />
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {job.company || "—"} · {formatSalaryDisplay(job.salary)} · {statusLabel(job.status)} · <JobViewCount views={job.views} forOwner />
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {job.status !== "published" && job.status !== "pending_review" ? (
                          <button type="button" onClick={() => updateJobStatus(job.id, "published")} className="h-9 px-3 rounded-lg bg-emerald-600 text-white text-xs font-medium">
                            Publish
                          </button>
                        ) : null}
                        <button type="button" onClick={() => handleDeleteJob(job.id)} className="h-9 px-3 rounded-lg text-xs font-medium text-rose-600">
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
          {jobFilter === "live" && listedJobs.length > 3 ? (
            <button
              type="button"
              onClick={() => setShowOlderLive((prev) => !prev)}
              className="mt-3 h-10 w-full rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700"
            >
              {showOlderLive ? "Hide older listings" : `Show ${listedJobs.length - 3} older listings`}
            </button>
          ) : null}
        </div>
      )}

      {tab === "people" && <AdminPeopleTab jobs={jobs} />}

      {tab === "sourcing" && (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-white border-b border-slate-200">
            <p className="text-sm font-medium text-slate-900">Pipeline tests</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Use <span className="font-medium text-slate-700">Run full pipeline now</span> at the top for a manual Greenhouse/Ashby/Lever run. Cron is 06:00 UTC. Listings without salary or apply stay unpublished.
            </p>
          </div>
          <SourcingRegistrySection />
        </div>
      )}

      {tab === "more" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium text-slate-900 mb-3">Site traffic</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <div className="text-slate-400">Views today</div>
                <div className="font-semibold text-slate-900">{analytics?.periods.today.totalViews ?? "—"}</div>
                <div className="text-xs text-slate-400">{analytics?.periods.today.uniqueVisitors ?? "—"} unique</div>
              </div>
              <div>
                <div className="text-slate-400">Views 7d</div>
                <div className="font-semibold text-slate-900">{analytics?.periods.week.totalViews ?? "—"}</div>
                <div className="text-xs text-slate-400">{analytics?.periods.week.uniqueVisitors ?? "—"} unique</div>
              </div>
              <div>
                <div className="text-slate-400">Views 30d</div>
                <div className="font-semibold text-slate-900">{analytics?.periods.month.totalViews ?? "—"}</div>
                <div className="text-xs text-slate-400">{analytics?.periods.month.uniqueVisitors ?? "—"} unique</div>
              </div>
              <div>
                <div className="text-slate-400">Users / jobs</div>
                <div className="font-semibold text-slate-900">
                  {adminStats.users} / {adminStats.jobs}
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-400">Page views from the site tracker. Job listing, company, and people URLs are grouped. Not a marketing claim.</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium text-slate-900 mb-1">Where people go</p>
            <p className="text-xs text-slate-500 mb-3">Last 7 days, then today. Counts are page views, not unique people.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">7 days</p>
                {(analytics?.pages?.week || []).length === 0 ? (
                  <p className="text-slate-400">No path data yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {(analytics?.pages?.week || []).map((row) => (
                      <li key={row.path} className="flex items-baseline justify-between gap-3">
                        <span className="text-slate-700 truncate">
                          {row.label} <span className="text-slate-400 text-xs">{row.path}</span>
                        </span>
                        <span className="font-medium text-slate-900 tabular-nums">{row.views}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-2">Today</p>
                {(analytics?.pages?.today || []).length === 0 ? (
                  <p className="text-slate-400">No views today.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {(analytics?.pages?.today || []).map((row) => (
                      <li key={row.path} className="flex items-baseline justify-between gap-3">
                        <span className="text-slate-700 truncate">
                          {row.label} <span className="text-slate-400 text-xs">{row.path}</span>
                        </span>
                        <span className="font-medium text-slate-900 tabular-nums">{row.views}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium text-slate-900 mb-3">Export</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Jobs CSV", href: "/api/admin/jobs/export", file: "jobs-export.csv" },
                { label: "Users CSV", href: "/api/admin/users/export", file: "users-export.csv" },
                { label: "Alerts CSV", href: "/api/admin/saved-jobs/export", file: "saved-jobs-export.csv" },
              ].map((item) => (
                <button
                  key={item.href}
                  onClick={() => handleExport(item.href, item.file)}
                  className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-600"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-sm font-medium text-slate-900">Alert subscribers</p>
              <p className="text-xs text-slate-500">{subscribers.length} people</p>
            </div>
            {subscribers.length === 0 ? (
              <p className="px-4 py-8 text-sm text-slate-500">No subscribers yet.</p>
            ) : (
              <table className="cp-table w-full text-sm">
                <tbody>
                  {subscribers.map((sub) => (
                    <tr key={sub.email} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2.5">{sub.email}</td>
                      <td className="px-3 py-2.5 text-slate-500">{sub.preference}</td>
                      <td className="px-3 py-2.5 text-right">
                        <button onClick={() => handleDeleteSubscriber(sub.email)} className="text-xs text-rose-600">
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
