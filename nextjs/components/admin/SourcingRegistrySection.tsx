"use client";

import { useEffect, useMemo, useState } from "react";
import { useSupabaseAuth } from "../Providers";
import { authFetch } from "../../lib/authFetch";

type SourcingSource = {
  id: string;
  company_id: string | null;
  display_name: string | null;
  base_url: string;
  normalized_url: string;
  source_type: string;
  validation_state: string;
  validation_confidence: string | null;
  enabled: boolean;
  created_at: string;
  approved_at: string | null;
  approval_decision: string | null;
  companies?: { name?: string | null; slug?: string | null } | null;
};

type SourcingReview = {
  id: string;
  status: "open" | "approved" | "rejected" | "held";
  decision: string | null;
  decision_reason_codes: unknown;
  notes: string | null;
  reviewer_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  source_id: string;
  sourcing_sources?: {
    id: string;
    company_id: string | null;
    display_name: string | null;
    base_url: string;
    normalized_url: string;
    source_type: string;
    validation_state: string;
    validation_confidence: string | null;
  } | null;
};

type SourcingRun = {
  id: string;
  source_id: string;
  status: "success" | "partial" | "failed";
  started_at: string;
  finished_at: string | null;
  fetched_count: number;
  new_raw_count: number;
  inserted_count?: number;
  skipped_count?: number;
  error_summary: string | null;
  created_at: string;
};

type RawSourcedJobRow = {
  id: string;
  source_id: string;
  source_run_id: string | null;
  external_job_id: string;
  title: string | null;
  job_url: string | null;
  fetched_at: string;
  source_type: string;
  source_url: string;
  payload_keys?: string[];
};

type RawSourcedJobDetail = {
  id: string;
  source_id: string;
  source_run_id: string | null;
  external_job_id: string;
  title: string | null;
  job_url: string | null;
  fetched_at: string;
  source_type: string;
  source_url: string;
  payload_hash?: string | null;
  raw_payload: unknown;
};

type NormalizedCandidateRow = {
  id: string;
  raw_job_id: string;
  source_id: string;
  source_run_id: string | null;
  external_job_id: string;
  title: string | null;
  company_name: string | null;
  apply_url: string | null;
  job_url: string | null;
  location_text: string | null;
  remote_policy: string | null;
  posted_at: string | null;
  salary_present: boolean;
  salary_currency: string | null;
  salary_period: string | null;
  salary_amount_min: number | null;
  salary_amount_max: number | null;
  published_job_id?: string | null;
  published_at?: string | null;
  publish_status?: string;
  publish_notes?: string | null;
  created_at: string;
};

type NormalizedCandidateDetail = Record<string, unknown> & { id: string; title?: string | null };

const formatTs = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
};

const Badge = ({ tone, children }: { tone: "slate" | "amber" | "emerald" | "red" | "indigo"; children: string }) => {
  const styles =
    tone === "emerald"
      ? "text-emerald-300 border-emerald-600/40 bg-emerald-600/10"
      : tone === "amber"
        ? "text-amber-300 border-amber-600/40 bg-amber-600/10"
        : tone === "red"
          ? "text-red-300 border-red-600/40 bg-red-600/10"
          : tone === "indigo"
            ? "text-indigo-200 border-indigo-700/40 bg-indigo-900/30"
            : "text-slate-300 border-slate-700 bg-slate-800/60";
  return (
    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${styles}`}>
      {children}
    </span>
  );
};

export default function SourcingRegistrySection() {
  const { accessToken } = useSupabaseAuth();
  const [sources, setSources] = useState<SourcingSource[]>([]);
  const [reviews, setReviews] = useState<SourcingReview[]>([]);
  const [runs, setRuns] = useState<SourcingRun[]>([]);
  const [rawJobs, setRawJobs] = useState<RawSourcedJobRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const [newBaseUrl, setNewBaseUrl] = useState("");
  const [newCompanyId, setNewCompanyId] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [createStatus, setCreateStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [createMsg, setCreateMsg] = useState("");

  const [reviewFilter, setReviewFilter] = useState<SourcingReview["status"]>("open");
  const [actionReviewId, setActionReviewId] = useState<string | null>(null);
  const [actionNotes, setActionNotes] = useState("");

  const [runFilterSourceId, setRunFilterSourceId] = useState<string>("");
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [rawLimit, setRawLimit] = useState<number>(50);
  const [selectedRawJobId, setSelectedRawJobId] = useState<string | null>(null);
  const [rawDetail, setRawDetail] = useState<RawSourcedJobDetail | null>(null);
  const [rawDetailLoading, setRawDetailLoading] = useState(false);
  const [runNowStatus, setRunNowStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [runNowMsg, setRunNowMsg] = useState<string>("");

  const [normalizeStatus, setNormalizeStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [normalizeMsg, setNormalizeMsg] = useState<string>("");
  const [candidates, setCandidates] = useState<NormalizedCandidateRow[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [candidateDetail, setCandidateDetail] = useState<NormalizedCandidateDetail | null>(null);
  const [candidateDetailLoading, setCandidateDetailLoading] = useState(false);
  const [evalStatus, setEvalStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [evalMsg, setEvalMsg] = useState<string>("");
  const [evalRows, setEvalRows] = useState<any[]>([]);
  const [autoPublishStatus, setAutoPublishStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [autoPublishMsg, setAutoPublishMsg] = useState<string>("");
  const [repairCompanySlug, setRepairCompanySlug] = useState<string>("samsara");
  const [repairCompanyStatus, setRepairCompanyStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [repairCompanyMsg, setRepairCompanyMsg] = useState<string>("");
  const [pipelineStatus, setPipelineStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [pipelineMsg, setPipelineMsg] = useState<string>("");
  const [backfillStatus, setBackfillStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [backfillMsg, setBackfillMsg] = useState<string>("");
  const [backfillPreview, setBackfillPreview] = useState<{ matched: number; scanned: number } | null>(null);
  const [enrichStatus, setEnrichStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [enrichMsg, setEnrichMsg] = useState<string>("");
  const [bulkEnrichStatus, setBulkEnrichStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [bulkEnrichMsg, setBulkEnrichMsg] = useState<string>("");
  const [unpublishStatus, setUnpublishStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [unpublishMsg, setUnpublishMsg] = useState<string>("");
  const [unpublishSalaryStatus, setUnpublishSalaryStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [unpublishSalaryMsg, setUnpublishSalaryMsg] = useState<string>("");

  const filteredReviews = useMemo(() => reviews.filter((r) => r.status === reviewFilter), [reviews, reviewFilter]);
  const filteredGreenhouseSources = useMemo(
    () => sources.filter((s) => s.source_type === "greenhouse"),
    [sources],
  );

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      if (!accessToken) throw new Error("Missing session token. Please sign in again.");
      const [sResp, rResp, runsResp] = await Promise.all([
        authFetch("/api/admin/sourcing/sources", { cache: "no-store" }, accessToken),
        authFetch("/api/admin/sourcing/reviews", { cache: "no-store" }, accessToken),
        authFetch("/api/admin/sourcing/runs?limit=50", { cache: "no-store" }, accessToken),
      ]);
      const sJson = (await sResp.json()) as { sources?: SourcingSource[]; error?: string };
      const rJson = (await rResp.json()) as { reviews?: SourcingReview[]; error?: string };
      const runJson = (await runsResp.json()) as { runs?: SourcingRun[]; error?: string };
      if (!sResp.ok) throw new Error(sJson.error || "Unable to load sources.");
      if (!rResp.ok) throw new Error(rJson.error || "Unable to load reviews.");
      if (!runsResp.ok) throw new Error(runJson.error || "Unable to load runs.");
      setSources(sJson.sources || []);
      setReviews(rJson.reviews || []);
      setRuns(runJson.runs || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sourcing registry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createSource = async () => {
    const baseUrl = newBaseUrl.trim();
    if (!baseUrl) {
      setCreateStatus("error");
      setCreateMsg("Missing URL.");
      return;
    }
    setCreateStatus("saving");
    setCreateMsg("");
    try {
      if (!accessToken) throw new Error("Missing session token. Please sign in again.");
      const resp = await authFetch(
        "/api/admin/sourcing/sources",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            baseUrl,
            companyId: newCompanyId.trim() || null,
            displayName: newDisplayName.trim() || null,
          }),
        },
        accessToken,
      );
      const json = (await resp.json()) as { sourceId?: string; reviewId?: string | null; error?: string };
      if (!resp.ok) throw new Error(json.error || "Failed to create source.");
      setCreateStatus("success");
      setCreateMsg(json.reviewId ? "Source added. Sent to review queue." : "Source added.");
      setNewBaseUrl("");
      setNewCompanyId("");
      setNewDisplayName("");
      await load();
    } catch (e) {
      setCreateStatus("error");
      setCreateMsg(e instanceof Error ? e.message : "Failed to create source.");
    }
  };

  const actOnReview = async (reviewId: string, decision: SourcingReview["decision"]) => {
    setActionReviewId(reviewId);
    try {
      if (!accessToken) throw new Error("Missing session token. Please sign in again.");
      const resp = await authFetch(
        "/api/admin/sourcing/reviews",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reviewId,
            decision,
            reasonCodes: [],
            notes: actionNotes.trim() || "",
          }),
        },
        accessToken,
      );
      const json = (await resp.json()) as { success?: boolean; error?: string };
      if (!resp.ok) throw new Error(json.error || "Failed to update review.");
      setActionNotes("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update review.");
    } finally {
      setActionReviewId(null);
    }
  };

  const loadRawJobs = async (opts?: { sourceId?: string; runId?: string }) => {
    try {
      if (!accessToken) throw new Error("Missing session token. Please sign in again.");
      const sourceId = (opts?.sourceId ?? "").trim();
      const runId = (opts?.runId ?? "").trim();
      const qs = new URLSearchParams();
      if (sourceId) qs.set("sourceId", sourceId);
      if (runId) qs.set("runId", runId);
      qs.set("limit", String(Math.min(200, Math.max(1, rawLimit))));
      const resp = await authFetch(`/api/admin/sourcing/raw-jobs?${qs.toString()}`, { cache: "no-store" }, accessToken);
      const json = (await resp.json()) as { jobs?: RawSourcedJobRow[]; error?: string };
      if (!resp.ok) throw new Error(json.error || "Unable to load raw jobs.");
      setRawJobs(json.jobs || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load raw jobs.");
    }
  };

  const openRawDetail = async (id: string) => {
    setSelectedRawJobId(id);
    setRawDetail(null);
    setRawDetailLoading(true);
    try {
      if (!accessToken) throw new Error("Missing session token. Please sign in again.");
      const resp = await authFetch(`/api/admin/sourcing/raw-jobs/${encodeURIComponent(id)}`, { cache: "no-store" }, accessToken);
      const json = (await resp.json()) as { job?: RawSourcedJobDetail; error?: string };
      if (!resp.ok || !json.job) throw new Error(json.error || "Unable to load raw payload.");
      setRawDetail(json.job);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load raw payload.");
    } finally {
      setRawDetailLoading(false);
    }
  };

  const runGreenhouseNow = async () => {
    setRunNowStatus("running");
    setRunNowMsg("");
    try {
      const payload = runFilterSourceId.trim() ? { sourceId: runFilterSourceId.trim() } : {};
      if (!accessToken) throw new Error("Missing session token. Please sign in again.");
      const resp = await authFetch(
        "/api/admin/sourcing/run/greenhouse",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
        accessToken,
      );
      const json = (await resp.json()) as {
        ran?: number;
        results?: Array<{
          sourceId: string;
          runId?: string;
          status: "success" | "partial" | "failed";
          fetchedCount?: number;
          insertedCount?: number;
          skippedCount?: number;
          error?: string;
        }>;
        error?: string;
      };
      if (!resp.ok) throw new Error(json.error || "Run failed.");

      const ok = (json.results || []).filter((r) => r.status === "success" || r.status === "partial");
      const fail = (json.results || []).filter((r) => r.status === "failed");
      const inserted = ok.reduce((acc, r) => acc + (r.insertedCount || 0), 0);
      const fetched = ok.reduce((acc, r) => acc + (r.fetchedCount || 0), 0);
      const msg = `Ran ${json.ran ?? (json.results || []).length}. Fetched ${fetched}. Inserted ${inserted}. Failed ${fail.length}.`;
      setRunNowStatus(fail.length > 0 && ok.length === 0 ? "error" : "success");
      setRunNowMsg(msg);

      // Refresh runs + raw jobs
      await load();

      // If we ran a single source and got a runId, auto-select it and load raw jobs.
      const firstRunId = ok.find((r) => Boolean(r.runId))?.runId;
      if (firstRunId) {
        setSelectedRunId(firstRunId);
        await loadRawJobs({ runId: firstRunId });
      } else {
        await loadRawJobs({ sourceId: runFilterSourceId.trim(), runId: selectedRunId.trim() });
      }
    } catch (e) {
      setRunNowStatus("error");
      setRunNowMsg(e instanceof Error ? e.message : "Run failed.");
    }
  };

  const runNormalization = async () => {
    setNormalizeStatus("running");
    setNormalizeMsg("");
    try {
      const payload: Record<string, unknown> = {};
      if (runFilterSourceId.trim()) payload.sourceId = runFilterSourceId.trim();
      if (selectedRunId.trim()) payload.runId = selectedRunId.trim();
      payload.limit = 300;

      if (!accessToken) throw new Error("Missing session token. Please sign in again.");
      const resp = await authFetch(
        "/api/admin/sourcing/normalize/greenhouse",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
        accessToken,
      );
      const json = (await resp.json()) as {
        processed?: number;
        inserted?: number;
        updated?: number;
        skipped?: number;
        errors?: Array<{ rawId: string; error: string }>;
        error?: string;
      };
      if (!resp.ok) throw new Error(json.error || "Normalization failed.");
      const msg = `Processed ${json.processed ?? 0}. Inserted ${json.inserted ?? 0}. Updated ${json.updated ?? 0}. Skipped ${json.skipped ?? 0}. Errors ${json.errors?.length ?? 0}.`;
      setNormalizeStatus((json.errors?.length || 0) > 0 ? "error" : "success");
      setNormalizeMsg(msg);
      await load();
      await loadCandidates();
    } catch (e) {
      setNormalizeStatus("error");
      setNormalizeMsg(e instanceof Error ? e.message : "Normalization failed.");
    }
  };

  const loadCandidates = async () => {
    try {
      if (!accessToken) throw new Error("Missing session token. Please sign in again.");
      const qs = new URLSearchParams();
      if (runFilterSourceId.trim()) qs.set("sourceId", runFilterSourceId.trim());
      if (selectedRunId.trim()) qs.set("runId", selectedRunId.trim());
      qs.set("limit", "100");
      const resp = await authFetch(`/api/admin/sourcing/candidates?${qs.toString()}`, { cache: "no-store" }, accessToken);
      const json = (await resp.json()) as { candidates?: NormalizedCandidateRow[]; error?: string };
      if (!resp.ok) throw new Error(json.error || "Unable to load candidates.");
      setCandidates(json.candidates || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load candidates.");
    }
  };

  const runAutoPublish = async () => {
    setAutoPublishStatus("running");
    setAutoPublishMsg("");
    try {
      const payload: Record<string, unknown> = { limit: 100 };
      if (runFilterSourceId.trim()) payload.sourceId = runFilterSourceId.trim();
      if (selectedRunId.trim()) payload.runId = selectedRunId.trim();
      if (!accessToken) throw new Error("Missing session token. Please sign in again.");
      const resp = await authFetch(
        "/api/admin/sourcing/auto-publish",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
        accessToken,
      );
      const json = (await resp.json()) as { published?: number; skipped?: number; failed?: number; minScore?: number; error?: string };
      if (!resp.ok) throw new Error(json.error || "Auto-publish failed.");
      setAutoPublishStatus(json.failed && json.failed > 0 ? "error" : "success");
      setAutoPublishMsg(
        `Auto-publish: published ${json.published ?? 0}, skipped ${json.skipped ?? 0}, failed ${json.failed ?? 0} (minScore ${json.minScore ?? "?"}).`,
      );
      await loadCandidates();
    } catch (e) {
      setAutoPublishStatus("error");
      setAutoPublishMsg(e instanceof Error ? e.message : "Auto-publish failed.");
    }
  };

  const runRepairCompany = async () => {
    setRepairCompanyStatus("running");
    setRepairCompanyMsg("");
    try {
      if (!accessToken) throw new Error("Missing session token. Please sign in again.");
      const slug = repairCompanySlug.trim();
      if (!slug) throw new Error("Enter a company slug (e.g., samsara).");
      const resp = await authFetch(
        "/api/admin/companies/repair",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) },
        accessToken,
      );
      const json = (await resp.json()) as any;
      if (!resp.ok) throw new Error(json.error || "Repair failed.");
      setRepairCompanyStatus("success");
      setRepairCompanyMsg(
        `Repaired ${json.slug}: relinked ${json.relinkedJobs ?? 0} jobs, patched ${Object.keys(json.patch || {}).length} fields.`,
      );
    } catch (e) {
      setRepairCompanyStatus("error");
      setRepairCompanyMsg(e instanceof Error ? e.message : "Repair failed.");
    }
  };

  const applyOfficialSamsaraCopy = async () => {
    setRepairCompanyStatus("running");
    setRepairCompanyMsg("");
    try {
      if (!accessToken) throw new Error("Missing session token. Please sign in again.");
      const slug = "samsara";
      const longDescription =
        "Samsara builds connected operations software for fleets and field teams. Its platform combines fleet telematics, AI-powered cameras, equipment tracking, workforce tools, and operational workflows to help organizations improve safety, efficiency, and visibility across physical operations.";
      const description =
        "Samsara provides software and hardware tools for companies that manage fleets, equipment, and field operations. Its products focus on safety, telematics, asset tracking, workforce management, and operational visibility.";
      const resp = await authFetch(
        "/api/admin/companies/repair",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, description, longDescription }),
        },
        accessToken,
      );
      const json = (await resp.json()) as any;
      if (!resp.ok) throw new Error(json.error || "Update failed.");
      setRepairCompanySlug("samsara");
      setRepairCompanyStatus("success");
      setRepairCompanyMsg("Applied official Samsara description.");
    } catch (e) {
      setRepairCompanyStatus("error");
      setRepairCompanyMsg(e instanceof Error ? e.message : "Update failed.");
    }
  };

  const toggleSourceEnabled = async (sourceId: string, enabled: boolean) => {
    try {
      if (!accessToken) throw new Error("Missing session token. Please sign in again.");
      const resp = await authFetch(
        "/api/admin/sourcing/sources",
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceId, enabled }) },
        accessToken,
      );
      const json = (await resp.json()) as { success?: boolean; error?: string };
      if (!resp.ok) throw new Error(json.error || "Unable to update source.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update source.");
    }
  };

  const runFullPipelineNow = async () => {
    setPipelineStatus("running");
    setPipelineMsg("");
    try {
      const payload: Record<string, unknown> = {};
      if (runFilterSourceId.trim()) payload.sourceId = runFilterSourceId.trim();
      if (!accessToken) throw new Error("Missing session token. Please sign in again.");
      const resp = await authFetch(
        "/api/admin/sourcing/pipeline/greenhouse",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
        accessToken,
      );
      const json = (await resp.json()) as { ok?: boolean; summary?: any; error?: string };
      if (!resp.ok || !json.summary) throw new Error(json.error || "Pipeline failed.");
      const s = json.summary;
      const msg =
        `Sources ${s.sources_processed ?? 0} • runs ${s.runs_created ?? 0} • raw inserted ${s.raw_inserted ?? 0} • ` +
        `candidates inserted ${s.normalization?.inserted ?? 0} • evaluated ${s.evaluation?.evaluated ?? 0} • ` +
        `published ${s.auto_publish?.published ?? 0} • dup-skipped ${s.auto_publish?.skipped_duplicates ?? 0}`;
      setPipelineStatus("success");
      setPipelineMsg(msg);
      await load();
      await loadCandidates();
      await loadEvals();
    } catch (e) {
      setPipelineStatus("error");
      setPipelineMsg(e instanceof Error ? e.message : "Pipeline failed.");
    }
  };

  const runBackfillGreenhouse = async (dryRun: boolean) => {
    setBackfillStatus("running");
    setBackfillMsg("");
    try {
      if (!accessToken) throw new Error("Missing session token. Please sign in again.");
      const resp = await authFetch(
        "/api/admin/sourcing/backfill/greenhouse",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: 200, dryRun }),
        },
        accessToken,
      );
      const json = (await resp.json()) as {
        ok?: boolean;
        dryRun?: boolean;
        scanned?: number;
        matched?: number;
        updated?: number;
        error?: string;
      };
      if (!resp.ok) throw new Error(json.error || "Backfill failed.");

      const scanned = Number(json.scanned || 0) || 0;
      const matched = Number(json.matched || 0) || 0;
      const updated = Number(json.updated || 0) || 0;

      if (dryRun) {
        setBackfillPreview({ scanned, matched });
        setBackfillMsg(`Preview: scanned ${scanned}, matched ${matched}.`);
      } else {
        setBackfillPreview(null);
        setBackfillMsg(`Applied: updated ${updated} (matched ${matched}, scanned ${scanned}).`);
      }
      setBackfillStatus("success");

      // Refresh sources/reviews after a backfill so the TYPE column updates.
      await load();
    } catch (e) {
      setBackfillStatus("error");
      setBackfillMsg(e instanceof Error ? e.message : "Backfill failed.");
    }
  };

  const openCandidateDetail = async (id: string) => {
    setSelectedCandidateId(id);
    setCandidateDetail(null);
    setCandidateDetailLoading(true);
    try {
      if (!accessToken) throw new Error("Missing session token. Please sign in again.");
      const resp = await authFetch(`/api/admin/sourcing/candidates/${encodeURIComponent(id)}`, { cache: "no-store" }, accessToken);
      const json = (await resp.json()) as { candidate?: NormalizedCandidateDetail; error?: string };
      if (!resp.ok || !json.candidate) throw new Error(json.error || "Unable to load candidate.");
      setCandidateDetail(json.candidate);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load candidate.");
    } finally {
      setCandidateDetailLoading(false);
    }
  };

  const enrichSalaryFromJobPage = async (candidateId: string) => {
    setEnrichStatus("running");
    setEnrichMsg("");
    try {
      if (!accessToken) throw new Error("Missing session token. Please sign in again.");
      const resp = await authFetch(
        `/api/admin/sourcing/candidates/${encodeURIComponent(candidateId)}/enrich-salary`,
        { method: "POST", headers: { "Content-Type": "application/json" } },
        accessToken,
      );
      const json = (await resp.json()) as { ok?: boolean; updated?: boolean; reason?: string; candidate?: any; error?: string };
      if (!resp.ok) throw new Error(json.error || "Enrichment failed.");
      if (json.updated) {
        setEnrichStatus("success");
        setEnrichMsg("Salary updated from job page.");
      } else {
        setEnrichStatus("success");
        setEnrichMsg(`No salary found (${json.reason || "not_found"}).`);
      }
      // Refresh candidate detail + list for badges.
      await openCandidateDetail(candidateId);
      await loadCandidates();
    } catch (e) {
      setEnrichStatus("error");
      setEnrichMsg(e instanceof Error ? e.message : "Enrichment failed.");
    }
  };

  const bulkEnrichMissingSalaries = async () => {
    setBulkEnrichStatus("running");
    setBulkEnrichMsg("");
    try {
      if (!accessToken) throw new Error("Missing session token. Please sign in again.");
      const payload: Record<string, unknown> = {
        limit: 30,
        concurrency: 3,
        cooldownHours: 24,
        scanLimit: 600,
      };
      if (runFilterSourceId.trim()) payload.sourceId = runFilterSourceId.trim();
      if (selectedRunId.trim()) payload.runId = selectedRunId.trim();

      const resp = await authFetch(
        "/api/admin/sourcing/candidates/enrich-salary-bulk",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
        accessToken,
      );
      const json = (await resp.json()) as {
        ok?: boolean;
        scanned?: number;
        attempted?: number;
        skipped_recent?: number;
        updated?: number;
        reopened?: number;
        not_found?: number;
        failed?: number;
        error?: string;
      };
      if (!resp.ok) throw new Error(json.error || "Bulk enrichment failed.");
      setBulkEnrichStatus(json.failed && json.failed > 0 ? "error" : "success");
      setBulkEnrichMsg(
        `Salary enrichment: attempted ${json.attempted ?? 0}/${json.scanned ?? 0}, updated ${json.updated ?? 0}, reopened ${json.reopened ?? 0}, not_found ${json.not_found ?? 0}, failed ${json.failed ?? 0}.`,
      );
      await loadCandidates();
    } catch (e) {
      setBulkEnrichStatus("error");
      setBulkEnrichMsg(e instanceof Error ? e.message : "Bulk enrichment failed.");
    }
  };

  const unpublishLowScore = async () => {
    setUnpublishStatus("running");
    setUnpublishMsg("");
    try {
      if (!accessToken) throw new Error("Missing session token. Please sign in again.");
      if (!runFilterSourceId.trim()) throw new Error("Select a source first (filter by sourceId).");
      const payload = { sourceId: runFilterSourceId.trim(), minScore: 85, maxToProcess: 500 };
      const resp = await authFetch(
        "/api/admin/sourcing/cleanup/unpublish-low-score",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
        accessToken,
      );
      const json = (await resp.json()) as {
        ok?: boolean;
        scanned?: number;
        below_threshold?: number;
        unpublished_jobs?: number;
        minScore?: number;
        error?: string;
      };
      if (!resp.ok) throw new Error(json.error || "Unpublish failed.");
      setUnpublishStatus("success");
      setUnpublishMsg(
        `Unpublish low-score: scanned ${json.scanned ?? 0}, below ${json.minScore ?? 85}: ${json.below_threshold ?? 0}, unpublished jobs ${json.unpublished_jobs ?? 0}.`,
      );
      await loadCandidates();
    } catch (e) {
      setUnpublishStatus("error");
      setUnpublishMsg(e instanceof Error ? e.message : "Unpublish failed.");
    }
  };

  const unpublishImplausibleSalary = async () => {
    setUnpublishSalaryStatus("running");
    setUnpublishSalaryMsg("");
    try {
      if (!accessToken) throw new Error("Missing session token. Please sign in again.");
      if (!runFilterSourceId.trim()) throw new Error("Select a source first (filter by sourceId).");
      const payload = { sourceId: runFilterSourceId.trim(), maxToProcess: 2000 };
      const resp = await authFetch(
        "/api/admin/sourcing/cleanup/unpublish-implausible-salary",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
        accessToken,
      );
      const json = (await resp.json()) as {
        ok?: boolean;
        scanned?: number;
        implausible?: number;
        unpublished_jobs?: number;
        error?: string;
      };
      if (!resp.ok) throw new Error(json.error || "Unpublish failed.");
      setUnpublishSalaryStatus("success");
      setUnpublishSalaryMsg(
        `Unpublish implausible salary: scanned ${json.scanned ?? 0}, flagged ${json.implausible ?? 0}, unpublished jobs ${json.unpublished_jobs ?? 0}.`,
      );
      await loadCandidates();
    } catch (e) {
      setUnpublishSalaryStatus("error");
      setUnpublishSalaryMsg(e instanceof Error ? e.message : "Unpublish failed.");
    }
  };

  const runEvaluate = async () => {
    setEvalStatus("running");
    setEvalMsg("");
    try {
      const payload: Record<string, unknown> = { limit: 300 };
      if (runFilterSourceId.trim()) payload.sourceId = runFilterSourceId.trim();
      if (selectedRunId.trim()) payload.runId = selectedRunId.trim();
      if (!accessToken) throw new Error("Missing session token. Please sign in again.");
      const resp = await authFetch(
        "/api/admin/sourcing/evaluate",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
        accessToken,
      );
      const json = (await resp.json()) as { processed?: number; evaluated?: number; errors?: unknown[]; error?: string };
      if (!resp.ok) throw new Error(json.error || "Evaluation failed.");
      setEvalStatus((json.errors?.length || 0) > 0 ? "error" : "success");
      setEvalMsg(`Processed ${json.processed ?? 0}. Evaluated ${json.evaluated ?? 0}. Errors ${json.errors?.length ?? 0}.`);
      await loadEvals();
    } catch (e) {
      setEvalStatus("error");
      setEvalMsg(e instanceof Error ? e.message : "Evaluation failed.");
    }
  };

  const loadEvals = async () => {
    try {
      if (!accessToken) throw new Error("Missing session token. Please sign in again.");
      const qs = new URLSearchParams();
      if (runFilterSourceId.trim()) qs.set("sourceId", runFilterSourceId.trim());
      if (selectedRunId.trim()) qs.set("runId", selectedRunId.trim());
      qs.set("limit", "100");
      const resp = await authFetch(`/api/admin/sourcing/evals?${qs.toString()}`, { cache: "no-store" }, accessToken);
      const json = (await resp.json()) as { evals?: any[]; error?: string };
      if (!resp.ok) throw new Error(json.error || "Unable to load evals.");
      setEvalRows(json.evals || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load evals.");
    }
  };

  return (
    <div className="lg:col-span-12 order-9">
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-widest">Sourcing registry</h3>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mt-1">
              Official hiring sources only (ATS + employer careers)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className={`px-4 py-2 rounded-xl border border-slate-800 text-[10px] font-black uppercase tracking-widest ${
                loading ? "text-slate-600 opacity-60 cursor-not-allowed" : "text-slate-300 hover:border-indigo-500/40 hover:text-indigo-300"
              }`}
            >
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-red-600/30 bg-red-600/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-red-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 bg-slate-950/40 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Add source</div>
              <Badge tone="slate">admin</Badge>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Careers / ATS URL</label>
                <input
                  value={newBaseUrl}
                  onChange={(e) => setNewBaseUrl(e.target.value)}
                  placeholder="https://jobs.lever.co/company"
                  className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm font-bold text-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/40"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Company ID (optional)</label>
                  <input
                    value={newCompanyId}
                    onChange={(e) => setNewCompanyId(e.target.value)}
                    placeholder="uuid"
                    className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm font-bold text-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/40"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Display name (optional)</label>
                  <input
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    placeholder="Company careers"
                    className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm font-bold text-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/40"
                  />
                </div>
              </div>

              <button
                onClick={createSource}
                disabled={createStatus === "saving"}
                className={`w-full rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest border ${
                  createStatus === "saving"
                    ? "bg-slate-950 text-slate-600 border-slate-800 cursor-not-allowed"
                    : "bg-indigo-600/20 text-indigo-200 border-indigo-600/40 hover:bg-indigo-600/30"
                }`}
              >
                {createStatus === "saving" ? "Adding..." : "Add source"}
              </button>

              {createMsg && (
                <div
                  className={`rounded-2xl border px-4 py-3 text-[10px] font-black uppercase tracking-widest ${
                    createStatus === "error"
                      ? "border-red-600/30 bg-red-600/10 text-red-300"
                      : "border-emerald-600/30 bg-emerald-600/10 text-emerald-300"
                  }`}
                >
                  {createMsg}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-7 bg-slate-950/40 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Review queue</div>
              <div className="flex flex-wrap gap-2">
                {(["open", "approved", "rejected", "held"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setReviewFilter(s)}
                    className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                      reviewFilter === s ? "border-indigo-500/40 bg-indigo-900/30 text-indigo-200" : "border-slate-700 bg-slate-800/60 text-slate-300 hover:text-white"
                    }`}
                  >
                    {s} ({reviews.filter((r) => r.status === s).length})
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {filteredReviews.length === 0 ? (
                <div className="text-sm text-slate-600 italic py-8 text-center">No items.</div>
              ) : (
                filteredReviews.map((r) => {
                  const src = r.sourcing_sources;
                  const stateTone =
                    src?.validation_state === "denied" ? "red" : src?.validation_state === "allowed" ? "emerald" : src?.validation_state === "hold" ? "amber" : "slate";
                  const typeTone = src?.source_type && src.source_type !== "unknown" ? "indigo" : "slate";
                  return (
                    <div key={r.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-black text-white truncate">
                            {src?.display_name || src?.base_url || r.source_id}
                          </div>
                          <div className="mt-1 text-xs text-slate-400 font-mono truncate">{src?.normalized_url || "—"}</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge tone={typeTone}>{src?.source_type || "unknown"}</Badge>
                            <Badge tone={stateTone}>{src?.validation_state || "unknown"}</Badge>
                            {src?.validation_confidence ? <Badge tone="slate">{src.validation_confidence}</Badge> : null}
                            <Badge tone="slate">{`created ${formatTs(r.created_at)}`}</Badge>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 w-full sm:w-auto">
                          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            Decision: {r.decision || "—"}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              disabled={actionReviewId === r.id}
                              onClick={() => actOnReview(r.id, "approve_as_official_ats")}
                              className="rounded-xl border border-emerald-600/30 bg-emerald-600/10 text-emerald-200 px-3 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600/20"
                            >
                              Approve ATS
                            </button>
                            <button
                              disabled={actionReviewId === r.id}
                              onClick={() => actOnReview(r.id, "approve_as_direct_custom")}
                              className="rounded-xl border border-indigo-600/30 bg-indigo-600/10 text-indigo-200 px-3 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600/20"
                            >
                              Approve direct
                            </button>
                            <button
                              disabled={actionReviewId === r.id}
                              onClick={() => actOnReview(r.id, "reject_third_party")}
                              className="rounded-xl border border-red-600/30 bg-red-600/10 text-red-200 px-3 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-red-600/20"
                            >
                              Reject
                            </button>
                            <button
                              disabled={actionReviewId === r.id}
                              onClick={() => actOnReview(r.id, "hold")}
                              className="rounded-xl border border-amber-600/30 bg-amber-600/10 text-amber-200 px-3 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-amber-600/20"
                            >
                              Hold
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Review notes</div>
                          <textarea
                            value={actionNotes}
                            onChange={(e) => setActionNotes(e.target.value)}
                            placeholder="Optional notes (why approved/denied)"
                            className="w-full min-h-[64px] rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs text-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/40"
                          />
                          <div className="mt-2 text-[10px] text-slate-600">
                            Reviewed: {formatTs(r.reviewed_at)} {r.reviewer_id ? `• by ${r.reviewer_id}` : ""}
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                          <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Why it is in review</div>
                          <div className="text-xs text-slate-300 font-mono whitespace-pre-wrap break-words">
                            {src?.validation_state && src.validation_state !== "allowed"
                              ? `validation_state=${src.validation_state}`
                              : "—"}
                          </div>
                          <div className="mt-2 text-[10px] text-slate-600">
                            Reason codes: {r.decision_reason_codes ? "present" : "—"}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="lg:col-span-12 bg-slate-950/40 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sources (latest)</div>
              <Badge tone="slate">{`${sources.length} total`}</Badge>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-[860px] w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-800">
                    <th className="py-2 pr-3">Source</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">State</th>
                    <th className="py-2 pr-3">Company</th>
                    <th className="py-2 pr-3">Enabled</th>
                    <th className="py-2 pr-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {(sources || []).slice(0, 20).map((s) => (
                    <tr key={s.id} className="border-b border-slate-900/60 text-xs text-slate-300">
                      <td className="py-3 pr-3 min-w-0">
                        <div className="font-bold text-white truncate">{s.display_name || s.base_url}</div>
                        <div className="text-[11px] font-mono text-slate-500 truncate">{s.normalized_url}</div>
                      </td>
                      <td className="py-3 pr-3">
                        <Badge tone={s.source_type !== "unknown" ? "indigo" : "slate"}>{s.source_type}</Badge>
                      </td>
                      <td className="py-3 pr-3">
                        <Badge tone={s.validation_state === "allowed" ? "emerald" : s.validation_state === "denied" ? "red" : s.validation_state === "hold" ? "amber" : "slate"}>
                          {s.validation_state}
                        </Badge>
                      </td>
                      <td className="py-3 pr-3">
                        <span className="text-slate-300">{s.companies?.name || s.company_id || "—"}</span>
                      </td>
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-2">
                          {s.enabled ? <Badge tone="emerald">yes</Badge> : <Badge tone="slate">no</Badge>}
                          <button
                            onClick={() => toggleSourceEnabled(s.id, !s.enabled)}
                            className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-slate-700 bg-slate-800/60 text-slate-300 hover:text-white"
                            title="Enable/disable this source (Greenhouse-only safety checks apply)"
                          >
                            {s.enabled ? "Disable" : "Enable"}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-slate-500">{formatTs(s.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 text-[10px] text-slate-600">Showing latest 20.</div>
          </div>

          {/* Ingestion inspection (Greenhouse) */}
          <div className="lg:col-span-12 bg-slate-950/40 border border-slate-800 rounded-2xl p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ingestion inspection</div>
                <div className="mt-1 text-sm font-black text-white">Greenhouse raw jobs</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="indigo">read-only</Badge>
                <Badge tone="slate">{`${runs.length} runs`}</Badge>
                <button
                  onClick={runFullPipelineNow}
                  disabled={pipelineStatus === "running"}
                  className={`px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-colors ${
                    pipelineStatus === "running"
                      ? "border-slate-800 bg-slate-950 text-slate-600 cursor-not-allowed"
                      : "border-indigo-500/40 bg-indigo-900/30 text-indigo-200 hover:bg-indigo-900/40"
                  }`}
                  title={runFilterSourceId ? "Runs full pipeline for selected source" : "Runs full pipeline for all enabled Greenhouse sources"}
                >
                  {pipelineStatus === "running" ? "Running pipeline..." : "Run full pipeline now"}
                </button>
                <button
                  onClick={() => runBackfillGreenhouse(true)}
                  disabled={backfillStatus === "running"}
                  className={`px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-colors ${
                    backfillStatus === "running"
                      ? "border-slate-800 bg-slate-950 text-slate-600 cursor-not-allowed"
                      : "border-amber-600/30 bg-amber-600/10 text-amber-200 hover:bg-amber-600/20"
                  }`}
                  title="Preview: finds canonical Greenhouse board sources incorrectly stored as unknown, without updating."
                >
                  Backfill Greenhouse sources
                </button>
                <button
                  onClick={() => runBackfillGreenhouse(false)}
                  disabled={backfillStatus === "running" || !(backfillPreview && backfillPreview.matched > 0)}
                  className={`px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-colors ${
                    backfillStatus === "running" || !(backfillPreview && backfillPreview.matched > 0)
                      ? "border-slate-800 bg-slate-950 text-slate-600 cursor-not-allowed"
                      : "border-red-600/30 bg-red-600/10 text-red-200 hover:bg-red-600/20"
                  }`}
                  title="Apply: updates matched sources (unknown -> greenhouse + ats_identifier). Enabled only if preview found matches."
                >
                  Apply backfill
                </button>
                <button
                  onClick={runGreenhouseNow}
                  disabled={runNowStatus === "running"}
                  className={`px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-colors ${
                    runNowStatus === "running"
                      ? "border-slate-800 bg-slate-950 text-slate-600 cursor-not-allowed"
                      : "border-emerald-600/30 bg-emerald-600/10 text-emerald-200 hover:bg-emerald-600/20"
                  }`}
                  title={runFilterSourceId ? "Runs only the selected source" : "Runs all enabled Greenhouse sources"}
                >
                  {runNowStatus === "running" ? "Running..." : "Run Greenhouse now"}
                </button>
                <button
                  onClick={runNormalization}
                  disabled={normalizeStatus === "running"}
                  className={`px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-colors ${
                    normalizeStatus === "running"
                      ? "border-slate-800 bg-slate-950 text-slate-600 cursor-not-allowed"
                      : "border-indigo-600/30 bg-indigo-600/10 text-indigo-200 hover:bg-indigo-600/20"
                  }`}
                  title="Normalize raw Greenhouse jobs into candidates (no scoring/publish)"
                >
                  {normalizeStatus === "running" ? "Normalizing..." : "Normalize now"}
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Company repair</div>
              <input
                value={repairCompanySlug}
                onChange={(e) => setRepairCompanySlug(e.target.value)}
                placeholder="company slug (e.g., samsara)"
                className="w-full sm:w-64 px-3 py-2 rounded-xl border border-slate-800 bg-slate-950/60 text-slate-200 text-sm font-bold placeholder:text-slate-600"
              />
              <button
                onClick={runRepairCompany}
                disabled={repairCompanyStatus === "running"}
                className={`px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-colors ${
                  repairCompanyStatus === "running"
                    ? "border-slate-800 bg-slate-950 text-slate-600 cursor-not-allowed"
                    : "border-emerald-600/30 bg-emerald-600/10 text-emerald-200 hover:bg-emerald-600/20"
                }`}
                title="Safely fill missing website/logo/description and relink jobs to the canonical company row."
              >
                {repairCompanyStatus === "running" ? "Repairing..." : "Repair company"}
              </button>
              {repairCompanySlug.trim().toLowerCase() === "samsara" && (
                <button
                  onClick={applyOfficialSamsaraCopy}
                  disabled={repairCompanyStatus === "running"}
                  className={`px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-colors ${
                    repairCompanyStatus === "running"
                      ? "border-slate-800 bg-slate-950 text-slate-600 cursor-not-allowed"
                      : "border-indigo-600/30 bg-indigo-600/10 text-indigo-200 hover:bg-indigo-600/20"
                  }`}
                  title="Applies official Samsara description copy (trust-first)."
                >
                  Apply official copy
                </button>
              )}
            </div>
            {repairCompanyMsg && (
              <div
                className={`mt-3 rounded-2xl border px-4 py-3 text-[10px] font-black uppercase tracking-widest ${
                  repairCompanyStatus === "error"
                    ? "border-red-600/30 bg-red-600/10 text-red-300"
                    : "border-emerald-600/30 bg-emerald-600/10 text-emerald-300"
                }`}
                role="status"
                aria-live="polite"
              >
                {repairCompanyMsg}
              </div>
            )}

            {runNowMsg && (
              <div
                className={`mt-4 rounded-2xl border px-4 py-3 text-[10px] font-black uppercase tracking-widest ${
                  runNowStatus === "error"
                    ? "border-red-600/30 bg-red-600/10 text-red-300"
                    : "border-emerald-600/30 bg-emerald-600/10 text-emerald-300"
                }`}
                role="status"
                aria-live="polite"
              >
                {runNowMsg}
              </div>
            )}
            {normalizeMsg && (
              <div
                className={`mt-3 rounded-2xl border px-4 py-3 text-[10px] font-black uppercase tracking-widest ${
                  normalizeStatus === "error"
                    ? "border-amber-600/30 bg-amber-600/10 text-amber-200"
                    : "border-indigo-600/30 bg-indigo-600/10 text-indigo-200"
                }`}
                role="status"
                aria-live="polite"
              >
                {normalizeMsg}
              </div>
            )}
            {pipelineMsg && (
              <div
                className={`mt-3 rounded-2xl border px-4 py-3 text-[10px] font-black uppercase tracking-widest ${
                  pipelineStatus === "error"
                    ? "border-red-600/30 bg-red-600/10 text-red-300"
                    : "border-indigo-600/30 bg-indigo-600/10 text-indigo-200"
                }`}
                role="status"
                aria-live="polite"
              >
                {pipelineMsg}
              </div>
            )}
            {backfillMsg && (
              <div
                className={`mt-3 rounded-2xl border px-4 py-3 text-[10px] font-black uppercase tracking-widest ${
                  backfillStatus === "error"
                    ? "border-red-600/30 bg-red-600/10 text-red-300"
                    : "border-amber-600/30 bg-amber-600/10 text-amber-200"
                }`}
                role="status"
                aria-live="polite"
              >
                {backfillMsg}
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Latest runs</div>

                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Filter by source</label>
                <select
                  value={runFilterSourceId}
                  onChange={(e) => {
                    setRunFilterSourceId(e.target.value);
                    setSelectedRunId("");
                    setRawJobs([]);
                  }}
                  className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3 text-xs font-black text-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/40"
                >
                  <option value="">All sources</option>
                  {filteredGreenhouseSources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {(s.display_name || s.base_url).slice(0, 64)}
                    </option>
                  ))}
                </select>

                <div className="mt-3 space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {runs
                    .filter((r) => (runFilterSourceId ? r.source_id === runFilterSourceId : true))
                    .slice(0, 20)
                    .map((r) => {
                      const tone = r.status === "success" ? "emerald" : r.status === "partial" ? "amber" : "red";
                      return (
                        <button
                          key={r.id}
                          onClick={() => {
                            setSelectedRunId(r.id);
                            loadRawJobs({ runId: r.id });
                          }}
                          className={`w-full text-left rounded-2xl border px-3 py-3 transition-colors ${
                            selectedRunId === r.id
                              ? "border-indigo-500/40 bg-indigo-900/20"
                              : "border-slate-800 bg-slate-950/40 hover:border-indigo-500/20"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-xs font-black text-white truncate">{r.id}</div>
                              <div className="mt-1 text-[10px] font-mono text-slate-500 truncate">
                                {formatTs(r.started_at)} → {formatTs(r.finished_at)}
                              </div>
                            </div>
                            <Badge tone={tone}>{r.status}</Badge>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge tone="slate">{`fetched ${r.fetched_count}`}</Badge>
                            <Badge tone="slate">{`inserted ${r.inserted_count ?? r.new_raw_count ?? 0}`}</Badge>
                            <Badge tone="slate">{`skipped ${r.skipped_count ?? 0}`}</Badge>
                          </div>
                          {r.error_summary ? (
                            <div className="mt-2 text-[10px] text-red-300">{r.error_summary}</div>
                          ) : null}
                        </button>
                      );
                    })}
                </div>
              </div>

              <div className="lg:col-span-8 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Recent raw jobs</div>
                    <div className="text-xs text-slate-400 font-mono mt-1">
                      {selectedRunId ? `runId=${selectedRunId}` : runFilterSourceId ? `sourceId=${runFilterSourceId}` : "latest"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Limit</label>
                    <select
                      value={rawLimit}
                      onChange={(e) => setRawLimit(Number(e.target.value))}
                      className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs font-black text-slate-200"
                    >
                      {[25, 50, 100, 200].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => loadRawJobs({ sourceId: runFilterSourceId, runId: selectedRunId })}
                      className="px-3 py-2 rounded-xl border border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:border-indigo-500/20 hover:text-indigo-300"
                    >
                      Refresh
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {rawJobs.length === 0 ? (
                    <div className="text-sm text-slate-600 italic py-12 text-center">
                      Select a run to load raw jobs.
                    </div>
                  ) : (
                    rawJobs.map((j) => (
                      <button
                        key={j.id}
                        onClick={() => openRawDetail(j.id)}
                        className="w-full text-left rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3 hover:border-indigo-500/20 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-black text-white truncate">{j.title || "(no title)"}</div>
                            <div className="mt-1 text-[10px] font-mono text-slate-500 truncate">
                              ext={j.external_job_id} • {formatTs(j.fetched_at)}
                            </div>
                            {j.job_url ? (
                              <div className="mt-1 text-[10px] font-mono text-indigo-300 truncate">{j.job_url}</div>
                            ) : null}
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge tone="indigo">{j.source_type}</Badge>
                            {j.payload_keys && j.payload_keys.length > 0 ? (
                              <Badge tone="slate">{`${j.payload_keys.length} keys`}</Badge>
                            ) : (
                              <Badge tone="slate">keys —</Badge>
                            )}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Normalized candidates</div>
                  <div className="mt-1 text-xs text-slate-400 font-mono">
                    {selectedRunId ? `runId=${selectedRunId}` : runFilterSourceId ? `sourceId=${runFilterSourceId}` : "latest"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={bulkEnrichMissingSalaries}
                    disabled={bulkEnrichStatus === "running"}
                    className={`px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-colors ${
                      bulkEnrichStatus === "running"
                        ? "border-slate-800 bg-slate-950 text-slate-600 cursor-not-allowed"
                        : "border-amber-600/30 bg-amber-600/10 text-amber-200 hover:bg-amber-600/20"
                    }`}
                    title="Fetch salary from official job pages for candidates missing salary (batched, conservative)."
                  >
                    {bulkEnrichStatus === "running" ? "Enriching salaries..." : "Enrich missing salaries"}
                  </button>
                  <button
                    onClick={runEvaluate}
                    disabled={evalStatus === "running"}
                    className={`px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-colors ${
                      evalStatus === "running"
                        ? "border-slate-800 bg-slate-950 text-slate-600 cursor-not-allowed"
                        : "border-emerald-600/30 bg-emerald-600/10 text-emerald-200 hover:bg-emerald-600/20"
                    }`}
                    title="Score + dedupe + decision prep (no publish)"
                  >
                    {evalStatus === "running" ? "Evaluating..." : "Evaluate now"}
                  </button>
                  <button
                    onClick={runAutoPublish}
                    disabled={autoPublishStatus === "running"}
                    className={`px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-colors ${
                      autoPublishStatus === "running"
                        ? "border-slate-800 bg-slate-950 text-slate-600 cursor-not-allowed"
                        : "border-indigo-600/30 bg-indigo-600/10 text-indigo-200 hover:bg-indigo-600/20"
                    }`}
                    title="Conservative auto-publish (Greenhouse-only, salary required, no duplicates)"
                  >
                    {autoPublishStatus === "running" ? "Publishing..." : "Auto-publish now"}
                  </button>
                  <button
                    onClick={unpublishLowScore}
                    disabled={unpublishStatus === "running" || !runFilterSourceId.trim()}
                    className={`px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-colors ${
                      unpublishStatus === "running" || !runFilterSourceId.trim()
                        ? "border-slate-800 bg-slate-950 text-slate-600 cursor-not-allowed"
                        : "border-red-600/30 bg-red-600/10 text-red-200 hover:bg-red-600/20"
                    }`}
                    title="Unpublish already-published sourced jobs below minScore (default 85) for the selected source."
                  >
                    {unpublishStatus === "running" ? "Unpublishing..." : "Unpublish low-score"}
                  </button>
                  <button
                    onClick={unpublishImplausibleSalary}
                    disabled={unpublishSalaryStatus === "running" || !runFilterSourceId.trim()}
                    className={`px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-colors ${
                      unpublishSalaryStatus === "running" || !runFilterSourceId.trim()
                        ? "border-slate-800 bg-slate-950 text-slate-600 cursor-not-allowed"
                        : "border-red-600/30 bg-red-600/10 text-red-200 hover:bg-red-600/20"
                    }`}
                    title="Unpublish already-published sourced jobs with obviously wrong salary (e.g., $1-$2) for the selected source."
                  >
                    {unpublishSalaryStatus === "running" ? "Unpublishing..." : "Unpublish $1-$2 salary"}
                  </button>
                  <button
                    onClick={() => {
                      loadCandidates();
                      loadEvals();
                    }}
                    className="px-3 py-2 rounded-xl border border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:border-indigo-500/20 hover:text-indigo-300"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {evalMsg && (
                <div
                  className={`mt-3 rounded-2xl border px-4 py-3 text-[10px] font-black uppercase tracking-widest ${
                    evalStatus === "error"
                      ? "border-amber-600/30 bg-amber-600/10 text-amber-200"
                      : "border-emerald-600/30 bg-emerald-600/10 text-emerald-300"
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  {evalMsg}
                </div>
              )}
              {bulkEnrichMsg && (
                <div
                  className={`mt-3 rounded-2xl border px-4 py-3 text-[10px] font-black uppercase tracking-widest ${
                    bulkEnrichStatus === "error"
                      ? "border-red-600/30 bg-red-600/10 text-red-300"
                      : "border-amber-600/30 bg-amber-600/10 text-amber-200"
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  {bulkEnrichMsg}
                </div>
              )}
              {unpublishMsg && (
                <div
                  className={`mt-3 rounded-2xl border px-4 py-3 text-[10px] font-black uppercase tracking-widest ${
                    unpublishStatus === "error"
                      ? "border-red-600/30 bg-red-600/10 text-red-300"
                      : "border-red-600/30 bg-red-600/10 text-red-200"
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  {unpublishMsg}
                </div>
              )}
              {unpublishSalaryMsg && (
                <div
                  className={`mt-3 rounded-2xl border px-4 py-3 text-[10px] font-black uppercase tracking-widest ${
                    unpublishSalaryStatus === "error"
                      ? "border-red-600/30 bg-red-600/10 text-red-300"
                      : "border-red-600/30 bg-red-600/10 text-red-200"
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  {unpublishSalaryMsg}
                </div>
              )}
              {autoPublishMsg && (
                <div
                  className={`mt-3 rounded-2xl border px-4 py-3 text-[10px] font-black uppercase tracking-widest ${
                    autoPublishStatus === "error"
                      ? "border-red-600/30 bg-red-600/10 text-red-300"
                      : "border-indigo-600/30 bg-indigo-600/10 text-indigo-200"
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  {autoPublishMsg}
                </div>
              )}

              <div className="mt-3 space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {candidates.length === 0 ? (
                  <div className="text-sm text-slate-600 italic py-10 text-center">
                    No candidates loaded yet. Run normalization, then refresh.
                  </div>
                ) : (
                  candidates.map((c) => (
                    (() => {
                      const ev = evalRows.find((e) => e.id === c.id);
                      const decision = ev?.sourcing_candidate_decisions?.decision || null;
                      const scoreTotal = ev?.sourcing_candidate_scores?.score_total ?? null;
                      const dup = ev?.sourcing_candidate_dedupes?.confidence || null;
                      const decisionTone =
                        decision === "auto_publish_candidate"
                          ? "emerald"
                          : decision === "reject_candidate"
                            ? "red"
                            : decision
                              ? "amber"
                              : "slate";
                      return (
                    <button
                      key={c.id}
                      onClick={() => openCandidateDetail(c.id)}
                      className="w-full text-left rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3 hover:border-indigo-500/20 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-black text-white truncate">{c.title || "(no title)"}</div>
                          <div className="mt-1 text-[10px] font-mono text-slate-500 truncate">
                            {c.company_name || "—"} • ext={c.external_job_id} • {formatTs(c.created_at)}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2">
                            <Badge tone={c.salary_present ? "emerald" : "amber"}>{c.salary_present ? "salary_present" : "salary_missing"}</Badge>
                            {typeof scoreTotal === "number" ? <Badge tone="slate">{`score ${scoreTotal}`}</Badge> : <Badge tone="slate">score —</Badge>}
                            {decision ? <Badge tone={decisionTone}>{decision}</Badge> : <Badge tone="slate">decision —</Badge>}
                            {dup ? <Badge tone={dup === "high" ? "red" : dup === "possible" ? "amber" : "slate"}>{`dup ${dup}`}</Badge> : <Badge tone="slate">dup —</Badge>}
                            {c.publish_status ? (
                              <Badge
                                tone={
                                  c.publish_status === "auto_published"
                                    ? "emerald"
                                    : c.publish_status === "skipped_duplicate"
                                      ? "amber"
                                      : c.publish_status === "failed"
                                        ? "red"
                                        : "slate"
                                }
                              >
                                {`pub ${c.publish_status}`}
                              </Badge>
                            ) : (
                              <Badge tone="slate">pub —</Badge>
                            )}
                            {c.salary_currency ? <Badge tone="slate">{c.salary_currency}</Badge> : null}
                            {c.salary_period ? <Badge tone="slate">{c.salary_period}</Badge> : null}
                            {typeof c.salary_amount_min === "number" ? <Badge tone="slate">{`min ${c.salary_amount_min}`}</Badge> : null}
                            {typeof c.salary_amount_max === "number" ? <Badge tone="slate">{`max ${c.salary_amount_max}`}</Badge> : null}
                          </div>
                        </div>
                        <Badge tone="indigo">candidate</Badge>
                      </div>
                    </button>
                      );
                    })()
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Raw payload modal */}
      {selectedRawJobId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-4xl rounded-2xl border border-slate-800 bg-[#0B1120] text-slate-200 shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Raw payload</div>
                <div className="mt-1 text-sm font-black text-white">{rawDetail?.title || "(loading...)"}</div>
              </div>
              <button
                onClick={() => {
                  setSelectedRawJobId(null);
                  setRawDetail(null);
                }}
                className="px-4 py-2 rounded-xl border border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="px-5 py-4">
              {rawDetailLoading ? (
                <div className="py-12 text-center text-slate-500 font-bold">Loading payload…</div>
              ) : rawDetail ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Context</div>
                      <div className="mt-2 text-xs text-slate-300 font-mono whitespace-pre-wrap break-words">
                        {`id=${rawDetail.id}\nsource_id=${rawDetail.source_id}\nrun_id=${rawDetail.source_run_id || "—"}\nexternal_job_id=${rawDetail.external_job_id}\nfetched_at=${rawDetail.fetched_at}`}
                      </div>
                      {rawDetail.job_url ? (
                        <a
                          href={rawDetail.job_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex text-[10px] font-black uppercase tracking-widest text-indigo-300 hover:text-indigo-200"
                        >
                          Open job URL →
                        </a>
                      ) : null}
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Payload</div>
                      <div className="mt-2 text-xs text-slate-400">
                        {rawDetail.payload_hash ? `sha256=${rawDetail.payload_hash}` : "sha256=—"}
                      </div>
                      <div className="mt-2 text-xs text-slate-400">{`source_type=${rawDetail.source_type}`}</div>
                      <div className="mt-2 text-xs text-slate-400 font-mono break-words">{`source_url=${rawDetail.source_url}`}</div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 overflow-auto max-h-[420px]">
                    <pre className="text-[11px] leading-relaxed text-slate-200 whitespace-pre-wrap break-words">
                      {JSON.stringify(rawDetail.raw_payload, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-500">No payload.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Candidate detail modal */}
      {selectedCandidateId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-4xl rounded-2xl border border-slate-800 bg-[#0B1120] text-slate-200 shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Normalized candidate</div>
                <div className="mt-1 text-sm font-black text-white">{(candidateDetail?.title as string) || "(loading...)"}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => enrichSalaryFromJobPage(selectedCandidateId)}
                  disabled={enrichStatus === "running"}
                  className={`px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-colors ${
                    enrichStatus === "running"
                      ? "border-slate-800 bg-slate-950 text-slate-600 cursor-not-allowed"
                      : "border-emerald-600/30 bg-emerald-600/10 text-emerald-200 hover:bg-emerald-600/20"
                  }`}
                  title="Fetch salary from the official job page (job_url) if present. Never inferred."
                >
                  {enrichStatus === "running" ? "Fetching salary..." : "Fetch salary from job page"}
                </button>
                <button
                  onClick={() => {
                    setSelectedCandidateId(null);
                    setCandidateDetail(null);
                    setEnrichStatus("idle");
                    setEnrichMsg("");
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:text-white"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="px-5 py-4">
              {enrichMsg && (
                <div
                  className={`mb-3 rounded-2xl border px-4 py-3 text-[10px] font-black uppercase tracking-widest ${
                    enrichStatus === "error"
                      ? "border-red-600/30 bg-red-600/10 text-red-300"
                      : "border-emerald-600/30 bg-emerald-600/10 text-emerald-200"
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  {enrichMsg}
                </div>
              )}
              {candidateDetailLoading ? (
                <div className="py-12 text-center text-slate-500 font-bold">Loading…</div>
              ) : candidateDetail ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 overflow-auto max-h-[520px]">
                  <pre className="text-[11px] leading-relaxed text-slate-200 whitespace-pre-wrap break-words">
                    {JSON.stringify(candidateDetail, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-500">No candidate.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

