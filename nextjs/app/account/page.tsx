"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSupabaseAuth } from "../../components/Providers";
import { authFetch } from "../../lib/authFetch";
import { createJobSlug } from "../../lib/jobs";
import { Job } from "../../types";
import { formatSalaryDisplay } from "../../lib/formatSalary";
import JobViewCount from "../../components/JobViewCount";
import { getCategoryHubForDbCategory, jobMatchesHub, parseAlertQuery, serializeAlertQuery } from "../../lib/categories";
import AlertCategoryPicker from "../../components/AlertCategoryPicker";
import { ALERT_MIN_SALARIES, ALERT_REGIONS, alertPrefsLabel, parseAlertPrefs, type AlertRegion } from "../../lib/alertPrefs";

type AccountUser = {
  name?: string;
  email?: string;
  image?: string;
  role?: string;
  isOnboarded?: boolean;
  headline?: string;
  bio?: string;
  hobbies?: string;
  visibility?: string;
  shareToken?: string;
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
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [hobbies, setHobbies] = useState("");
  const [visibility, setVisibility] = useState<"private" | "employers" | "link">("private");
  const [shareToken, setShareToken] = useState("");
  const [photoMsg, setPhotoMsg] = useState("");
  const [files, setFiles] = useState<UserFile[]>([]);
  const [savedJobs, setSavedJobs] = useState<string[]>([]);
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [subscriber, setSubscriber] = useState<SubscriberRow | null>(null);
  const [alertQuery, setAlertQuery] = useState<string>("all");
  const [alertMinSalary, setAlertMinSalary] = useState(0);
  const [alertRegion, setAlertRegion] = useState<AlertRegion>("anywhere");
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
          setHeadline(data.user.headline || "");
          setBio(data.user.bio || "");
          setHobbies(data.user.hobbies || "");
          if (data.user.visibility === "employers" || data.user.visibility === "link" || data.user.visibility === "private") {
            setVisibility(data.user.visibility);
          }
          setShareToken(data.user.shareToken || "");
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
          const prefs = parseAlertPrefs(subData.subscriber.preference);
          setAlertQuery(prefs.categories);
          setAlertMinSalary(prefs.minSalary || 0);
          setAlertRegion(prefs.region);
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

  const suggestedJobs = useMemo(() => {
    const saved = savedJobRows.map((row) => row.job).filter(Boolean) as Job[];
    const hubs = saved
      .map((job) => getCategoryHubForDbCategory(job.category || ""))
      .filter(Boolean);
    const pool = allJobs.filter((job) => !savedJobs.includes(job.id));
    const ranked =
      hubs.length > 0
        ? pool.filter((job) => hubs.some((hub) => hub && jobMatchesHub(job, hub)))
        : pool;
    return ranked.slice(0, 3);
  }, [savedJobRows, allJobs, savedJobs]);

  const firstName = (name || "").trim().split(/\s+/)[0] || "";

  const handlePhotoFile = async (file: File | undefined) => {
    if (!file || !accessToken) return;
    if (!file.type.startsWith("image/")) {
      setPhotoMsg("Choose a photo file.");
      return;
    }
    setPhotoMsg("");
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) return;
      const response = await authFetch(
        "/api/account/avatar",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl }),
        },
        accessToken,
      );
      const data = (await response.json()) as { user?: AccountUser; error?: string };
      if (data.user?.image) setImage(data.user.image);
      else setPhotoMsg(data.error || "Could not save photo.");
    };
    reader.readAsDataURL(file);
  };

  const handleCvFile = async (file: File | undefined) => {
    if (!file || !accessToken) return;
    setIsUploading(true);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
        reader.onerror = () => reject(new Error("read_failed"));
        reader.readAsDataURL(file);
      });
      if (!dataUrl) return;
      const response = await authFetch(
        "/api/files",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            url: dataUrl,
            mimeType: file.type || "application/pdf",
            size: file.size || 1,
          }),
        },
        accessToken,
      );
      const data = (await response.json()) as { file?: UserFile };
      if (data.file) setFiles((prev) => [data.file!, ...prev]);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const response = await authFetch(
        "/api/account",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, headline, bio, hobbies, visibility }),
        },
        accessToken,
      );
      const data = (await response.json()) as { user?: AccountUser };
      if (data.user) {
        setUser(data.user);
        setName(data.user.name || "");
        setImage(data.user.image || "");
        setHeadline(data.user.headline || headline);
        setBio(data.user.bio || bio);
        setHobbies(data.user.hobbies || hobbies);
        if (data.user.visibility === "employers" || data.user.visibility === "link" || data.user.visibility === "private") {
          setVisibility(data.user.visibility);
        }
        if (data.user.shareToken) setShareToken(data.user.shareToken);
      }
      setEditingName(false);
    } finally {
      setIsSaving(false);
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
      const email = (user?.email || "").trim();
      if (!email) {
        setAlertMsg("Add an email on your profile first.");
        return;
      }
      if (accessToken) {
        await authFetch(
          "/api/alerts",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: alertQuery }),
          },
          accessToken,
        );
      }
      const subRes = await fetch("/api/alerts/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          categories: parseAlertQuery(alertQuery),
          minSalary: alertMinSalary,
          region: alertRegion,
        }),
      });
      const subData = (await subRes.json()) as { subscriber?: SubscriberRow; error?: string; pendingConfirm?: boolean };
      if (!subRes.ok) {
        setAlertMsg(subData.error || "Unable to save alert.");
        return;
      }
      const refresh = await authFetch("/api/subscribers", {}, accessToken);
      const refreshed = (await refresh.json()) as { subscriber?: SubscriberRow | null };
      if (refreshed.subscriber) setSubscriber(refreshed.subscriber);
      setAlertMsg(
        subData.pendingConfirm
          ? "Check your email. Click the confirm link before we send roles."
          : "Alert saved. Tuesday and Friday, matching published roles.",
      );
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
              <div className="relative mx-auto h-24 w-24">
                <div className="h-24 w-24 rounded-full bg-indigo-50 text-indigo-700 overflow-hidden border border-indigo-100 flex items-center justify-center text-2xl font-semibold">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initialsFrom(name, user?.email)
                  )}
                </div>
                <label
                  htmlFor="cp-avatar-upload"
                  className="absolute -bottom-0.5 -right-0.5 h-8 w-8 rounded-full bg-indigo-600 text-white text-lg leading-8 text-center cursor-pointer shadow-sm hover:bg-indigo-700"
                  title="Upload photo"
                >
                  +
                </label>
                <input
                  id="cp-avatar-upload"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    void handlePhotoFile(file);
                  }}
                />
              </div>
              {photoMsg && <p className="mt-2 text-xs text-rose-600">{photoMsg}</p>}
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
                    <h1 className="text-xl font-semibold text-slate-900">
                      {firstName ? `Welcome back, ${firstName}` : name || "Your space"}
                    </h1>
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
              {headline && <p className="mt-1 text-sm font-medium text-slate-700">{headline}</p>}
              {user?.email && <p className="mt-1 text-sm text-slate-500">{user.email}</p>}
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
                  {user?.role === "admin" && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
                      <p className="text-sm font-medium text-slate-900">Admin</p>
                      <p className="text-xs text-slate-500 mt-1">Confirm listings, jobs, team, and traffic from here too.</p>
                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[
                          { label: "Ops console", href: "/dashboard/ops" },
                          { label: "Dashboard", href: "/dashboard/admin" },
                          { label: "To confirm", href: "/dashboard/admin?tab=review" },
                          { label: "All jobs", href: "/dashboard/admin?tab=jobs" },
                          { label: "Team", href: "/dashboard/admin?tab=people" },
                          { label: "Traffic", href: "/dashboard/admin?tab=more" },
                          { label: "My listings", href: "/dashboard/employer" },
                        ].map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            className="h-9 px-3 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:border-indigo-300"
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Saved", value: String(savedJobs.length), href: "/account?tab=saved" },
                      { label: "Alerts", value: subscriber ? "On" : "Off", href: "/account?tab=alerts" },
                      { label: "CV / files", value: String(files.length), href: "/account?tab=documents" },
                    ].map((item) => (
                      <Link
                        key={item.label}
                        href={item.href}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center hover:border-indigo-200"
                      >
                        <div className="text-lg font-semibold text-slate-900">{item.value}</div>
                        <div className="text-[11px] font-medium text-slate-500">{item.label}</div>
                      </Link>
                    ))}
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                    <p className="text-sm font-medium text-slate-900">Who can see this profile</p>
                    <div className="space-y-2">
                      {(
                        [
                          {
                            id: "private" as const,
                            title: "Only me",
                            body: "Employers cannot view your profile.",
                          },
                          {
                            id: "employers" as const,
                            title: "Employers on CareersPal",
                            body: "Signed-in employers can open your profile. CareersPal may later suggest you on a reviewed role. You still apply on their job link.",
                          },
                          {
                            id: "link" as const,
                            title: "Anyone with my link",
                            body: "Not listed. Only people you send the link to can open it.",
                          },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setVisibility(opt.id);
                            void (async () => {
                              const response = await authFetch(
                                "/api/account",
                                {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ visibility: opt.id, name, headline, bio, hobbies }),
                                },
                                accessToken,
                              );
                              const data = (await response.json()) as { user?: AccountUser };
                              if (data.user?.shareToken) setShareToken(data.user.shareToken);
                            })();
                          }}
                          className={`w-full rounded-xl border px-3 py-2.5 text-left ${
                            visibility === opt.id
                              ? "border-indigo-500 bg-indigo-50"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                        >
                          <div className="text-sm font-medium text-slate-900">{opt.title}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{opt.body}</div>
                        </button>
                      ))}
                    </div>
                    {visibility !== "private" && shareToken && (
                      <p className="text-xs text-slate-500">
                        Preview:{" "}
                        <Link href={`/p/${shareToken}`} className="text-indigo-600 font-medium">
                          Open my public profile
                        </Link>
                      </p>
                    )}

                    <p className="text-sm font-medium text-slate-900 pt-2">About you</p>
                    <p className="text-xs text-slate-500">
                      {visibility === "private"
                        ? "Saved on your account only until you change who can see this."
                        : visibility === "employers"
                          ? "Employers signed in on CareersPal can see the fields below. Email stays private."
                          : "People with your link can see the fields below. Email stays private."}
                    </p>
                    <input
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      placeholder="e.g. RevOps manager · Notion & Salesforce"
                      className="cp-field w-full h-10 rounded-lg px-3 text-sm"
                    />
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="What you work on. Tools you like. What you’re looking for next."
                      rows={4}
                      className="cp-field w-full rounded-lg px-3 py-2 text-sm min-h-[6rem]"
                    />
                    <input
                      value={hobbies}
                      onChange={(e) => setHobbies(e.target.value)}
                      placeholder="Outside work: cycling, chess, cooking…"
                      className="cp-field w-full h-10 rounded-lg px-3 text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleSaveProfile}
                      disabled={isSaving}
                      className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-50"
                    >
                      {isSaving ? "Saving…" : "Save profile"}
                    </button>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900">
                        {savedJobs.length > 0 ? "Because you saved similar roles" : "Latest on the board"}
                      </p>
                      <Link href="/jobs" className="text-xs font-medium text-indigo-600">
                        See all
                      </Link>
                    </div>
                    <div className="mt-3 space-y-2">
                      {suggestedJobs.length === 0 ? (
                        <p className="text-sm text-slate-500">No live roles to show yet.</p>
                      ) : (
                        suggestedJobs.map((job) => (
                          <Link
                            key={job.id}
                            href={`/jobs/${createJobSlug(job)}`}
                            className="block rounded-lg border border-slate-100 px-3 py-2 hover:border-indigo-200"
                          >
                            <div className="text-sm font-medium text-slate-900 truncate">{job.title}</div>
                            <div className="text-xs text-slate-500 truncate">
                              {[job.company, formatSalaryDisplay(job.salary)].filter(Boolean).join(" · ")} ·{" "}
                              <JobViewCount views={job.views} />
                            </div>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link href="/jobs" className="h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium inline-flex items-center">
                      Browse jobs
                    </Link>
                    <Link href="/account?tab=alerts" className="h-9 px-4 rounded-lg border border-slate-200 text-sm font-medium inline-flex items-center">
                      Email alerts
                    </Link>
                    <Link href="/account?tab=documents" className="h-9 px-4 rounded-lg border border-slate-200 text-sm font-medium inline-flex items-center">
                      Upload CV
                    </Link>
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
                            {job ? (
                              <>
                                {" · "}
                                <JobViewCount views={job.views} />
                              </>
                            ) : null}
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
                    <p className="text-sm text-slate-600">Fresh openings in your inbox. Stay in the picture.</p>
                    <AlertCategoryPicker
                      selected={parseAlertQuery(alertQuery)}
                      onChange={(next) => setAlertQuery(serializeAlertQuery(next))}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="block">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Minimum salary</span>
                        <select
                          value={alertMinSalary}
                          onChange={(event) => setAlertMinSalary(Number(event.target.value))}
                          className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800"
                        >
                          {ALERT_MIN_SALARIES.map((amount) => (
                            <option key={amount} value={amount}>
                              {amount === 0 ? "Any listed salary" : `$${Math.round(amount / 1000)}k+ a year`}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Region</span>
                        <select
                          value={alertRegion}
                          onChange={(event) => setAlertRegion(event.target.value as AlertRegion)}
                          className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800"
                        >
                          {ALERT_REGIONS.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
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
                        Sending to {subscriber.email} · {alertPrefsLabel(parseAlertPrefs(subscriber.preference))}
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
                    Keep a CV here for yourself. We don’t send files to employers — you apply on their link.
                  </p>
                  <label className="inline-flex h-10 items-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white cursor-pointer">
                    {isUploading ? "Uploading…" : "Upload CV"}
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        void handleCvFile(file);
                      }}
                    />
                  </label>
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
                </div>
              )}

              {tab === "settings" && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                    <p className="text-sm font-medium text-slate-900">Photo</p>
                    <p className="text-sm text-slate-500">Change it with the + on your avatar. No URL needed.</p>
                    {image && (
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
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-sm font-medium text-slate-900">Account type</p>
                    {user?.role === "admin" ? (
                      <>
                        <p className="mt-1 text-sm text-slate-500">This account is admin. Role switch is off so you keep dashboard access.</p>
                        <div className="mt-3 h-9 rounded-lg border border-slate-800 bg-slate-800 text-white text-sm inline-flex items-center px-3">
                          Admin
                        </div>
                      </>
                    ) : (
                      <>
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
                      </>
                    )}
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
