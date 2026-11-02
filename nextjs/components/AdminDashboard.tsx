"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Subscriber } from "../services/notificationService";
import { Job } from "../types";
import { useSupabaseAuth } from "./Providers";
import { authFetch } from "../lib/authFetch";
import { formatSalaryDisplay } from "../lib/formatSalary";
import SourcingRegistrySection from "./admin/SourcingRegistrySection";

type AnalyticsPeriod = {
  totalViews: number;
  uniqueVisitors: number;
  newVisitors: number;
  returningVisitors: number;
};

type AnalyticsPayload = {
  periods: {
    today: AnalyticsPeriod;
    week: AnalyticsPeriod;
    month: AnalyticsPeriod;
    all: AnalyticsPeriod;
  };
};

interface AdminDashboardProps {
  onLogout: () => void;
}

type AdminTab = "review" | "jobs" | "sourcing" | "more";

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
  const [jobFilter, setJobFilter] = useState<"all" | "live" | "draft" | "archived">("live");
  const [tab, setTab] = useState<AdminTab>("review");
  const [tabReady, setTabReady] = useState(false);
  const jobSearchRef = useRef<HTMLDivElement>(null);
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const { accessToken } = useSupabaseAuth();
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    title: string;
    description: string;
    location: string;
    remotePolicy: string;
    type: string;
    salary: string;
  } | null>(null);
  const [showAdminCreate, setShowAdminCreate] = useState(false);
  const [adminCreateStatus, setAdminCreateStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [adminCreateMsg, setAdminCreateMsg] = useState("");
  const [jobActionTone, setJobActionTone] = useState<"idle" | "success" | "error">("idle");
  const [jobActionMsg, setJobActionMsg] = useState("");
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
    const date = new Date(value < 1e12 ? value * 1000 : value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
      if (data.job) setJobs((prev) => prev.map((j) => (j.id === id ? data.job! : j)));
      setJobActionTone("success");
      setJobActionMsg(status === "published" ? "Published." : status === "private" ? "Archived." : "Updated.");
    } catch {
      setJobActionTone("error");
      setJobActionMsg("Action failed.");
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

  const pendingJobs = sortedJobs.filter((job) => job.status === "pending_review");
  const listedJobs = useMemo(() => {
    if (jobFilter === "live") return sortedJobs.filter((job) => job.status === "published");
    if (jobFilter === "draft") return sortedJobs.filter((job) => job.status === "draft");
    if (jobFilter === "archived") return sortedJobs.filter((job) => job.status === "private" || job.status === "archived" || job.status === "closed");
    return sortedJobs;
  }, [sortedJobs, jobFilter]);

  useEffect(() => {
    if (tabReady) return;
    if (jobs.length === 0 && !accessToken) return;
    setTab(pendingJobs.length > 0 ? "review" : "jobs");
    setTabReady(true);
  }, [tabReady, pendingJobs.length, jobs.length, accessToken]);

  const fieldClass = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";
  const labelClass = "text-xs font-medium text-slate-500";

  const renderJobRow = (job: Job, mode: "review" | "jobs") => {
    const open = expandedJobId === job.id;
    return (
      <React.Fragment key={job.id}>
        <tr className="border-b border-slate-100 last:border-0">
          <td className="px-4 py-2.5">
            <button type="button" className="text-left font-medium text-slate-900 line-clamp-2 hover:text-indigo-700" onClick={() => setExpandedJobId(open ? null : job.id)}>
              {job.title}
            </button>
            <div className="sm:hidden text-xs text-slate-500 mt-0.5">{job.company}</div>
          </td>
          <td className="px-3 py-2.5 text-slate-600 hidden sm:table-cell whitespace-nowrap">{job.company}</td>
          <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">{formatSalaryDisplay(job.salary)}</td>
          {mode === "jobs" && (
            <td className="px-3 py-2.5">
              <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded ${statusTone(job.status)}`}>{statusLabel(job.status)}</span>
            </td>
          )}
          <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap hidden md:table-cell">{formatDate(job.timestamp)}</td>
          <td className="px-3 py-2.5 whitespace-nowrap text-right">
            {mode === "review" ? (
              <div className="flex justify-end gap-2">
                <button onClick={() => updateJobStatus(job.id, "published")} className="h-8 px-3 rounded-lg bg-emerald-600 text-white text-xs font-medium">
                  Publish
                </button>
                <button onClick={() => updateJobStatus(job.id, "private")} className="h-8 px-3 rounded-lg border border-slate-200 text-xs font-medium text-slate-600">
                  Decline
                </button>
              </div>
            ) : (
              <button type="button" className="h-8 w-8 rounded-md text-slate-400 hover:bg-slate-50" onClick={() => setExpandedJobId(open ? null : job.id)} aria-label="Open">
                {open ? "–" : "⋯"}
              </button>
            )}
          </td>
        </tr>
        {open && (
          <tr className="border-b border-slate-100 bg-slate-50/70">
            <td colSpan={mode === "jobs" ? 6 : 5} className="px-4 py-4">
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
    { id: "review", label: "Review", count: pendingJobs.length },
    { id: "jobs", label: "Jobs", count: jobs.filter((j) => j.status === "published").length },
    { id: "sourcing", label: "Sourcing" },
    { id: "more", label: "More" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Admin</h1>
          <p className="text-sm text-slate-500 mt-1">
            {pendingJobs.length > 0 ? `${pendingJobs.length} waiting for review.` : "Board is clear. Next: jobs or sourcing."}
          </p>
        </div>
        <button onClick={onLogout} className="h-9 px-3 rounded-lg border border-slate-200 text-sm font-medium text-slate-600">
          Log out
        </button>
      </div>

      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`h-10 px-3 text-sm font-medium border-b-2 -mb-px ${
              tab === item.id ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {item.label}
            {typeof item.count === "number" ? <span className="ml-1.5 text-slate-400">{item.count}</span> : null}
          </button>
        ))}
      </div>

      {jobActionMsg && (
        <div className={`mb-4 rounded-lg border px-3 py-2 text-sm ${jobActionTone === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
          {jobActionMsg}
        </div>
      )}

      {tab === "review" && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {pendingJobs.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="font-medium text-slate-900">Nothing to review</p>
              <p className="text-sm text-slate-500 mt-1">Employer submissions show up here. Switch to Jobs to manage the board.</p>
              <button onClick={() => setTab("jobs")} className="mt-4 h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium">
                Open jobs
              </button>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs font-medium text-slate-400 border-b border-slate-100">
                  <th className="px-4 py-2.5 font-medium">Title</th>
                  <th className="px-3 py-2.5 font-medium hidden sm:table-cell">Company</th>
                  <th className="px-3 py-2.5 font-medium">Salary</th>
                  <th className="px-3 py-2.5 font-medium hidden md:table-cell">Date</th>
                  <th className="px-3 py-2.5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>{pendingJobs.map((job) => renderJobRow(job, "review"))}</tbody>
            </table>
          )}
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
            {(["live", "draft", "archived", "all"] as const).map((id) => (
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

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {listedJobs.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-slate-500">No jobs in this filter.</div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs font-medium text-slate-400 border-b border-slate-100">
                    <th className="px-4 py-2.5 font-medium">Title</th>
                    <th className="px-3 py-2.5 font-medium hidden sm:table-cell">Company</th>
                    <th className="px-3 py-2.5 font-medium">Salary</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="px-3 py-2.5 font-medium hidden md:table-cell">Date</th>
                    <th className="px-3 py-2.5 font-medium w-10"></th>
                  </tr>
                </thead>
                <tbody>{listedJobs.map((job) => renderJobRow(job, "jobs"))}</tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === "sourcing" && (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-white border-b border-slate-200">
            <p className="text-sm font-medium text-slate-900">Greenhouse pipeline</p>
            <p className="text-xs text-slate-500 mt-0.5">Run ingest, check salary, publish. This is the only place for sourcing tools.</p>
          </div>
          <SourcingRegistrySection />
        </div>
      )}

      {tab === "more" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium text-slate-900 mb-3">Snapshot</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <div className="text-slate-400">Users</div>
                <div className="font-semibold text-slate-900">{adminStats.users}</div>
              </div>
              <div>
                <div className="text-slate-400">Jobs</div>
                <div className="font-semibold text-slate-900">{adminStats.jobs}</div>
              </div>
              <div>
                <div className="text-slate-400">Views today</div>
                <div className="font-semibold text-slate-900">{analytics?.periods.today.totalViews ?? "—"}</div>
              </div>
              <div>
                <div className="text-slate-400">Views 7d</div>
                <div className="font-semibold text-slate-900">{analytics?.periods.week.totalViews ?? "—"}</div>
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
              <table className="w-full text-sm">
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
