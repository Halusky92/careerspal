"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseAuth } from "../../components/Providers";
import { authFetch } from "../../lib/authFetch";
import { createJobSlug } from "../../lib/jobs";

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
type Activity = {
  savedJobs: { jobId: string; createdAt: string }[];
  files: { name: string; createdAt: string }[];
};

const AccountPage = () => {
  const router = useRouter();
  const { accessToken, loading: authLoading, signOut } = useSupabaseAuth();
  const [user, setUser] = useState<AccountUser | null>(null);
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [files, setFiles] = useState<UserFile[]>([]);
  const [savedJobs, setSavedJobs] = useState<string[]>([]);
  const [allJobs, setAllJobs] = useState<{ id: string; title: string }[]>([]);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [healthStatus, setHealthStatus] = useState<"ok" | "error" | "unknown">("unknown");
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [fileType, setFileType] = useState("application/pdf");
  const [fileSize, setFileSize] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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
        const jobsData = (await jobsRes.json()) as { jobs?: { id: string; title: string }[] };
        setAllJobs(jobsData.jobs || []);
        const activityRes = await authFetch("/api/account/activity", {}, accessToken);
        const activityData = (await activityRes.json()) as { activity?: Activity };
        if (activityData.activity) setActivity(activityData.activity);
        const healthRes = await fetch("/api/health");
        setHealthStatus(healthRes.ok ? "ok" : "error");
      } catch {
        // noop
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [accessToken, authLoading, router]);

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
      if (data.user) setUser(data.user);
    } finally {
      setIsSaving(false);
    }
  };


  const handleUpload = async () => {
    if (!fileName || !fileUrl || !fileType || !fileSize) return;
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
          mimeType: fileType,
          size: fileSize,
        }),
        },
        accessToken,
      );
      const data = (await response.json()) as { file?: UserFile };
      if (data.file) {
        setFiles((prev) => [data.file!, ...prev]);
        setFileName("");
        setFileUrl("");
        setFileType("application/pdf");
        setFileSize(0);
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
      router.replace(nextRole === "employer" ? "/dashboard/employer" : "/dashboard/candidate");
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-indigo-600"
      >
        <span>← Back</span>
      </button>
      <div className="mb-10">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Account</p>
        <h1 className="text-4xl font-black text-slate-900 mt-3">Profile & Security</h1>
        <p className="text-slate-500 font-medium mt-2">
          Manage your public profile, access settings, and verified files.
        </p>
        {user?.email && (
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-3">
            Signed in as {user.email}{user.role ? ` • ${user.role}` : ""}
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="bg-white/80 backdrop-blur border border-slate-200/60 rounded-[2.5rem] p-10 text-center shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <div className="inline-flex items-center gap-3 text-slate-500 font-bold">
            <span className="h-3 w-3 rounded-full bg-indigo-500 animate-pulse"></span>
            Loading account...
          </div>
        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-8">
          <div className="bg-white/80 backdrop-blur border border-slate-200/60 rounded-[2.5rem] p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Profile</h3>
            <div className="mt-6 space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200/70 px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Avatar URL</label>
                <input
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200/70 px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300"
                />
                <button
                  onClick={async () => {
                    await authFetch("/api/account/avatar", { method: "DELETE" }, accessToken);
                    setImage("");
                  }}
                  className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600"
                >
                  Remove avatar
                </button>
              </div>
              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-black transition-all disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Save profile"}
              </button>
            </div>
          </div>

        </div>

        <div className="lg:col-span-5 space-y-8">
          <div className="bg-white/80 backdrop-blur border border-slate-200/60 rounded-[2.5rem] p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Account status</h3>
            <div className="mt-6 space-y-3 text-sm font-bold text-slate-600">
              <div className="flex items-center justify-between">
                <span>Email</span>
                <span>{user?.email || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Role</span>
                <span className="uppercase">{user?.role || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Onboarded</span>
                <span>{user?.isOnboarded ? "Yes" : "No"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Saved jobs</span>
                <span>{savedJobs.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>System</span>
                <span className={healthStatus === "ok" ? "text-emerald-600" : "text-amber-500"}>
                  {healthStatus === "ok" ? "Operational" : "Degraded"}
                </span>
              </div>
            </div>
            <button
              onClick={handleDeleteAccount}
              disabled={isLoading}
              className="mt-6 w-full border border-red-200 text-red-600 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Delete account
            </button>
            <a
              href="/api/account/activity"
              target="_blank"
              rel="noreferrer"
              className={`mt-3 w-full inline-flex justify-center border border-slate-200 text-slate-600 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:border-indigo-200 hover:text-indigo-600 ${
                isLoading ? "opacity-60 pointer-events-none" : ""
              }`}
            >
              Download data
            </a>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => handleSwitchRole("candidate")}
                disabled={user?.role === "candidate"}
                className={`text-center border py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:text-indigo-600 hover:border-indigo-200 ${
                  user?.role === "candidate"
                    ? "border-indigo-200 text-indigo-600 cursor-default"
                    : "border-slate-200 text-slate-500"
                }`}
              >
                Candidate
              </button>
              <button
                onClick={() => handleSwitchRole("employer")}
                disabled={user?.role === "employer"}
                className={`text-center border py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:text-indigo-600 hover:border-indigo-200 ${
                  user?.role === "employer"
                    ? "border-indigo-200 text-indigo-600 cursor-default"
                    : "border-slate-200 text-slate-500"
                }`}
              >
                Employer
              </button>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur border border-slate-200/60 rounded-[2.5rem] p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Saved jobs ({savedJobs.length})</h3>
            <div className="mt-6 space-y-3">
              {savedJobs.length === 0 ? (
                <div className="text-sm text-slate-400 font-medium">
                  <p>No saved roles yet.</p>
                  <button
                    onClick={() => router.push("/jobs")}
                    className="mt-3 text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:underline"
                  >
                    Browse jobs
                  </button>
                </div>
              ) : (
                savedJobs.map((jobId) => {
                  const job = allJobs.find((j) => j.id === jobId);
                  const href = job ? `/jobs/${createJobSlug(job)}` : "#";
                  return (
                    <div key={jobId} className="flex items-center justify-between text-sm font-bold text-slate-600 gap-3">
                      <span className="truncate">{job?.title || jobId}</span>
                      <div className="flex items-center gap-3">
                        <a href={href} className="text-indigo-600 hover:underline">
                          View
                        </a>
                        <button
                          onClick={() => handleRemoveSaved(jobId)}
                          className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur border border-slate-200/60 rounded-[2.5rem] p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Files ({files.length})</h3>
            <div className="mt-6 space-y-3">
              <input
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="File name"
                className="w-full rounded-2xl border border-slate-200/70 px-5 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300"
              />
              <input
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                placeholder="Public file URL"
                className="w-full rounded-2xl border border-slate-200/70 px-5 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  value={fileType}
                  onChange={(e) => setFileType(e.target.value)}
                  placeholder="MIME type"
                  className="w-full rounded-2xl border border-slate-200/70 px-5 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300"
                />
                <input
                  type="number"
                  value={fileSize || ""}
                  onChange={(e) => setFileSize(Number(e.target.value))}
                  placeholder="Size (bytes)"
                  className="w-full rounded-2xl border border-slate-200/70 px-5 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300"
                />
              </div>
              <button
                onClick={handleUpload}
                disabled={isUploading}
                className="w-full bg-indigo-600 text-white py-3 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-60"
              >
                {isUploading ? "Uploading..." : "Add file"}
              </button>
            </div>

            <div className="mt-6 space-y-3">
              {files.length === 0 ? (
                <p className="text-sm text-slate-400 font-medium">No files uploaded yet.</p>
              ) : (
                files.map((file) => (
                  <div key={file.id} className="flex items-center justify-between text-sm font-bold text-slate-600">
                    <span className="truncate">{file.name}</span>
                    <a href={file.url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                      View
                    </a>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur border border-slate-200/60 rounded-[2.5rem] p-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Recent activity</h3>
            <div className="mt-6 space-y-3 text-sm font-bold text-slate-600">
              {activity?.savedJobs?.slice(0, 3).map((item) => (
                <div key={`saved-${item.jobId}`} className="flex items-center justify-between">
                  <span className="truncate">
                    Saved {allJobs.find((job) => job.id === item.jobId)?.title || `job ${item.jobId}`}
                  </span>
                  <span className="text-[10px] text-slate-400">{new Date(item.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
              {activity?.files?.slice(0, 3).map((item) => (
                <div key={`file-${item.name}`} className="flex items-center justify-between">
                  <span className="truncate">Uploaded {item.name}</span>
                  <span className="text-[10px] text-slate-400">{new Date(item.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
              {!activity && <p className="text-slate-400 font-medium">No activity yet.</p>}
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

export default AccountPage;
