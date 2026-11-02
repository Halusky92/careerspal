"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSupabaseAuth } from "../../components/Providers";
import { authFetch } from "../../lib/authFetch";
import { createJobSlug } from "../../lib/jobs";
import { Job } from "../../types";
import { formatSalaryDisplay } from "../../lib/formatSalary";
import { CATEGORY_HUBS, getCategoryHub, resolveCategoryParam } from "../../lib/categories";

type AccountUser = {
  name?: string;
  email?: string;
  image?: string;
  role?: string;
  isOnboarded?: boolean;
};

type UserFile = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  url: string;
  createdAt: string;
};

type Tab = "profile" | "saved" | "alerts" | "documents" | "settings";

type AlertRow = { id: string; query: string; created_at?: string };
type SubscriberRow = { email: string; preference: string; created_at?: string };

const initialsFrom = (name?: string, email?: string) => {
  const source = (name || email || "C").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
};

const AccountPageInner = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accessToken, loading: authLoading, signOut } = useSupabaseAuth();
  const [user, setUser] = useState<AccountUser | null>(null);
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [files, setFiles] = useState<UserFile[]>([]);
  const [savedJobs, setSavedJobs] = useState<string[]>([]);
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [subscriber, setSubscriber] = useState<SubscriberRow | null>(null);
  const [alertQuery, setAlertQuery] = useState<string>(CATEGORY_HUBS[0].slug);
  const [alertBusy, setAlertBusy] = useState(false);
  const [alertMsg, setAlertMsg] = useState("");

  const tab = (searchParams.get("tab") as Tab) || "profile";
  const setTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "profile") params.delete("tab");
    else params.set("tab", next);
    const qs = params.toString();
    router.replace(qs ? `/account?${qs}` : "/account");
  };

  useEffect(() => {
    const load = async () => {
      if (authLoading) return;
      if (!accessToken) {
        router.replace("/auth");
        return;
      }
      try {
        const response = await authFetch("/api/account", {}, accessToken);
        if (response.status === 401) {
          router.replace("/auth");
          return;
        }
        const data = (await response.json()) as { user?: AccountUser };
        if (data.user) {
          setUser(data.user);
          setName(data.user.name || "");
          setImage(data.user.image || "");
        }
        const filesRes = await authFetch("/api/files", {}, accessToken);
        const filesData = (await filesRes.json()) as { files?: UserFile[] };
        setFiles(filesData.files || []);
        const savedRes = await authFetch("/api/saved-jobs", {}, accessToken);
        const savedData = (await savedRes.json()) as { savedJobs?: { jobId: string }[] };
        setSavedJobs(savedData.savedJobs?.map((item) => item.jobId) || []);
        const jobsRes = await fetch("/api/jobs");
        const jobsData = (await jobsRes.json()) as { jobs?: Job[] };
        setAllJobs(jobsData.jobs || []);
        const alertsRes = await authFetch("/api/alerts", {}, accessToken);
        const alertsData = (await alertsRes.json()) as { alerts?: AlertRow[] };
        setAlerts(alertsData.alerts || []);
        const subRes = await authFetch("/api/subscribers", {}, accessToken);
        const subData = (await subRes.json()) as { subscriber?: SubscriberRow | null };
        setSubscriber(subData.subscriber || null);
        if (subData.subscriber?.preference) {
          const hub = getCategoryHub(resolveCategoryParam(subData.subscriber.preference));
          setAlertQuery(hub?.slug || CATEGORY_HUBS[0].slug);
        }
      } catch {
        // keep empty
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [accessToken, authLoading, router]);

  const savedJobRows = useMemo(
    () =>
      savedJobs.map((jobId) => {
        const job = allJobs.find((j) => j.id === jobId);
        return { jobId, job };
      }),
    [savedJobs, allJobs],
  );

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const response = await authFetch(
        "/api/account",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, image }),
        },
        accessToken,
      );
      const data = (await response.json()) as { user?: AccountUser };
      if (data.user) {
        setUser(data.user);
        setName(data.user.name || "");
        setImage(data.user.image || "");
      }
      setEditingName(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpload = async () => {
    if (!fileName || !fileUrl) return;
    setIsUploading(true);
    try {
      const response = await authFetch(
        "/api/files",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: fileName,
            url: fileUrl,
            mimeType: "application/pdf",
            size: 1,
          }),
        },
        accessToken,
      );
      const data = (await response.json()) as { file?: UserFile };
      if (data.file) {
        setFiles((prev) => [data.file!, ...prev]);
        setFileName("");
        setFileUrl("");
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveSaved = async (jobId: string) => {
    try {
      await authFetch(
        "/api/saved-jobs",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId }),
        },
        accessToken,
      );
    } catch {
      // noop
    } finally {
      setSavedJobs((prev) => prev.filter((id) => id !== jobId));
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm("This will permanently delete your account. Continue?")) return;
    await authFetch("/api/account/delete", { method: "DELETE" }, accessToken);
    signOut();
    router.replace("/auth");
  };

  const handleSaveAlert = async () => {
    setAlertBusy(true);
    setAlertMsg("");
    try {
      const response = await authFetch(
        "/api/alerts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: alertQuery }),
        },
        accessToken,
      );
      const payload = (await response.json()) as { alert?: AlertRow; error?: string };
      if (!response.ok) {
        setAlertMsg(payload.error || "Unable to save alert.");
        return;
      }
      if (payload.alert) {
        setAlerts((prev) => (prev.some((row) => row.id === payload.alert!.id) ? prev : [payload.alert!, ...prev]));
      }
      const subRes = await authFetch(
        "/api/subscribers",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preference: alertQuery }),
        },
        accessToken,
      );
      const subData = (await subRes.json()) as { subscriber?: SubscriberRow };
      if (subData.subscriber) setSubscriber(subData.subscriber);
      setAlertMsg("Alert saved. We’ll email new matching jobs.");
    } finally {
      setAlertBusy(false);
    }
  };

  const handleDeleteAlert = async (id: string) => {
    await authFetch(
      "/api/alerts",
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      },
      accessToken,
    );
    setAlerts((prev) => prev.filter((row) => row.id !== id));
  };

  const handleStopEmail = async () => {
    setAlertBusy(true);
    try {
      await authFetch("/api/subscribers", { method: "DELETE" }, accessToken);
      setSubscriber(null);
      setAlerts([]);
      setAlertMsg("Email alerts stopped.");
    } finally {
      setAlertBusy(false);
    }
  };

  const handleSwitchRole = async (nextRole: "candidate" | "employer") => {
    try {
      await authFetch(
        "/api/account/role",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: nextRole }),
        },
        accessToken,
      );
    } catch {
      // noop
    } finally {
      router.replace(nextRole === "employer" ? "/dashboard/employer" : "/account");
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "profile", label: "Profile" },
    { id: "saved", label: "Saved" },
    { id: "alerts", label: "Alerts" },
    { id: "documents", label: "Documents" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div className="bg-white min-h-[calc(100vh-3.5rem)]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {isLoading ? (
          <div className="text-center py-16 text-sm text-slate-500">Loading profile…</div>
        ) : (
          <>
            <div className="text-center">
              <div className="mx-auto h-24 w-24 rounded-full bg-indigo-50 text-indigo-700 overflow-hidden border border-indigo-100 flex items-center justify-center text-2xl font-semibold">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt="" className="h-full w-full object-cover" />
                ) : (
                  initialsFrom(name, user?.email)
                )}
              </div>
              <div className="mt-3 flex items-center justify-center gap-2">
                {editingName ? (
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={handleSaveProfile}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveProfile();
                    }}
                    autoFocus
                    className="h-9 w-56 rounded-lg border border-slate-300 px-3 text-center text-lg font-semibold text-slate-900"
                  />
                ) : (
                  <>
                    <h1 className="text-xl font-semibold text-slate-900">{name || "Your profile"}</h1>
                    <button
                      type="button"
                      onClick={() => setEditingName(true)}
                      className="text-slate-400 hover:text-indigo-600"
                      aria-label="Edit name"
                    >
                      ✎
                    </button>
                  </>
                )}
              </div>
              {user?.email && <p className="mt-1 text-sm text-slate-500">{user.email}</p>}
              <p className="mt-3 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                You apply directly. Employers don’t browse candidate profiles here.
              </p>
            </div>

            <div className="mt-6 flex justify-center flex-wrap gap-x-6 gap-y-1 border-b border-slate-200">
              {tabs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`h-10 text-sm font-medium border-b-2 -mb-px ${
                    tab === item.id
                      ? "border-indigo-600 text-indigo-700"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {item.label}
                  {item.id === "saved" && savedJobs.length > 0 ? ` (${savedJobs.length})` : ""}
                </button>
              ))}
            </div>

            <div className="mt-5">
              {tab === "profile" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-sm font-medium text-slate-900">What this account does</p>
                    <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
                      <li>Save roles and come back to them.</li>
                      <li>Get email alerts for new published jobs.</li>
                      <li>Apply on the employer’s own link — we don’t run a talent pool.</li>
                    </ul>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link href="/jobs" className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium inline-flex items-center">
                        Browse jobs
                      </Link>
                      <Link href="/account?tab=alerts" className="h-9 px-4 rounded-lg border border-slate-200 text-sm font-medium inline-flex items-center">
                        Job alerts
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {tab === "saved" && (
                <div className="space-y-2">
                  {savedJobRows.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
                      <p className="text-sm text-slate-600">No saved roles yet.</p>
                      <Link href="/jobs" className="mt-3 inline-flex text-sm font-medium text-indigo-600">
                        Browse jobs
                      </Link>
                    </div>
                  ) : (
                    savedJobRows.map(({ jobId, job }) => (
                      <div key={jobId} className="rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            href={job ? `/jobs/${createJobSlug(job)}` : "/jobs"}
                            className="block text-sm font-medium text-slate-900 truncate hover:text-indigo-700"
                          >
                            {job?.title || jobId}
                          </Link>
                          <p className="text-xs text-slate-500 truncate">
                            {[job?.company, job?.location, job ? formatSalaryDisplay(job.salary) : ""]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveSaved(jobId)}
                          className="text-xs text-slate-500 hover:text-red-600 shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {tab === "alerts" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                    <p className="text-sm font-medium text-slate-900">Get new jobs by email</p>
                    <p className="text-sm text-slate-600">Change the category or stop alerts. Same list as the Alerts page.</p>
                    <label className="block text-xs font-medium text-slate-500" htmlFor="account-alert-category">
                      Category
                    </label>
                    <select
                      id="account-alert-category"
                      value={alertQuery}
                      onChange={(e) => setAlertQuery(e.target.value)}
                      className="cp-field w-full h-10 rounded-lg px-3 text-sm"
                    >
                      {CATEGORY_HUBS.map((hub) => (
                        <option key={hub.slug} value={hub.slug}>
                          {hub.label}
                        </option>
                      ))}
                    </select>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleSaveAlert}
                        disabled={alertBusy}
                        className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-50"
                      >
                        {alertBusy ? "Saving…" : subscriber ? "Update alert" : "Turn on alerts"}
                      </button>
                      {subscriber && (
                        <button
                          type="button"
                          onClick={handleStopEmail}
                          disabled={alertBusy}
                          className="h-9 px-4 rounded-lg border border-slate-200 text-sm font-medium text-slate-700"
                        >
                          Stop email alerts
                        </button>
                      )}
                    </div>
                    {alertMsg && <p className="text-sm text-slate-600">{alertMsg}</p>}
                    {subscriber && (
                      <p className="text-xs text-slate-500">
                        Sending to {subscriber.email} · {getCategoryHub(resolveCategoryParam(subscriber.preference))?.label || subscriber.preference}
                      </p>
                    )}
                  </div>
                  {alerts.length > 0 && (
                    <div className="space-y-2">
                      {alerts.map((row) => (
                        <div key={row.id} className="rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between gap-3">
                          <p className="text-sm text-slate-800 truncate">{row.query}</p>
                          <button
                            type="button"
                            onClick={() => handleDeleteAlert(row.id)}
                            className="text-xs text-slate-500 hover:text-red-600 shrink-0"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab === "documents" && (
                <div className="space-y-3">
                  <p className="text-sm text-slate-500">
                    Files stay in your account. We don’t send them to employers — you apply through their link.
                  </p>
                  {files.map((file) => (
                    <div key={file.id} className="rounded-xl border border-slate-200 px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">{file.name}</div>
                        <div className="text-xs text-slate-500">
                          {file.createdAt ? new Date(file.createdAt).toLocaleDateString() : ""}
                        </div>
                      </div>
                      <a href={file.url} target="_blank" rel="noreferrer" className="text-sm text-indigo-600">
                        Open
                      </a>
                    </div>
                  ))}
                  <div className="rounded-xl border border-dashed border-slate-300 p-4 space-y-2">
                    <p className="text-sm font-medium text-slate-800">Add a document link</p>
                    <input
                      value={fileName}
                      onChange={(e) => setFileName(e.target.value)}
                      placeholder="File name"
                      className="cp-field w-full h-10 rounded-lg px-3 text-sm"
                    />
                    <input
                      value={fileUrl}
                      onChange={(e) => setFileUrl(e.target.value)}
                      placeholder="https://…"
                      className="cp-field w-full h-10 rounded-lg px-3 text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleUpload}
                      disabled={isUploading || !fileName || !fileUrl}
                      className="h-10 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-50"
                    >
                      {isUploading ? "Saving…" : "Add"}
                    </button>
                  </div>
                </div>
              )}

              {tab === "settings" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                    <p className="text-sm font-medium text-slate-900">Photo URL</p>
                    <input
                      value={image}
                      onChange={(e) => setImage(e.target.value)}
                      placeholder="https://…"
                      className="cp-field w-full h-10 rounded-lg px-3 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSaveProfile}
                        disabled={isSaving}
                        className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium"
                      >
                        {isSaving ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await authFetch("/api/account/avatar", { method: "DELETE" }, accessToken);
                          setImage("");
                        }}
                        className="h-9 px-3 text-sm text-slate-500"
                      >
                        Remove photo
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-sm font-medium text-slate-900">Account type</p>
                    <p className="mt-1 text-sm text-slate-500">Switch only if you also hire on the board.</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleSwitchRole("candidate")}
                        disabled={user?.role === "candidate"}
                        className={`h-9 rounded-lg border text-sm ${
                          user?.role === "candidate"
                            ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                            : "border-slate-200 text-slate-600"
                        }`}
                      >
                        Candidate
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSwitchRole("employer")}
                        disabled={user?.role === "employer"}
                        className={`h-9 rounded-lg border text-sm ${
                          user?.role === "employer"
                            ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                            : "border-slate-200 text-slate-600"
                        }`}
                      >
                        Employer
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                    <a
                      href="/api/account/activity"
                      target="_blank"
                      rel="noreferrer"
                      className="block h-9 px-3 rounded-lg border border-slate-200 text-sm text-slate-700 inline-flex items-center"
                    >
                      Download my data
                    </a>
                    <button
                      type="button"
                      onClick={handleDeleteAccount}
                      className="block w-full h-9 rounded-lg border border-red-200 text-sm text-red-600"
                    >
                      Delete account
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-slate-500">Loading profile…</div>}>
      <AccountPageInner />
    </Suspense>
  );
}
