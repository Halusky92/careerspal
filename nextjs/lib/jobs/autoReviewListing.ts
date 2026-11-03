import { GoogleGenAI } from "@google/genai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isOnNicheJob } from "../nicheScope";
import { scoreCandidate } from "../sourcing/evaluation/scoring";
import { REASON_SEVERITY, type ReasonCode } from "../sourcing/evaluation/reasonCodes";

export type ListingReviewInput = {
  id?: string;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  salary?: string | null;
  apply_url?: string | null;
  company?: string | null;
  location?: string | null;
  remote_policy?: string | null;
  stripe_payment_status?: string | null;
  plan_price?: number | null;
  created_by?: string | null;
  plan_type?: string | null;
  status?: string | null;
};

export type ScreenIssue = { field: string; message: string };

export type ListingReviewResult = {
  decision: "publish" | "hold";
  reasons: string[];
  issues: ScreenIssue[];
  score: number;
  aiNote?: string;
};

const isWorkingApply = (raw?: string | null) => {
  const value = (raw || "").trim();
  if (!value || value === "#") return false;
  if (value.startsWith("mailto:") && value.includes("@")) return true;
  if (value.includes("@") && !value.includes(" ")) return true;
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const hasSalary = (raw?: string | null) => {
  const value = (raw || "").trim();
  if (!value) return false;
  if (/^(tbd|n\/a|negotiable|competitive|-)$/i.test(value)) return false;
  return /\d/.test(value);
};

const REASON_COPY: Record<string, ScreenIssue> = {
  OFF_NICHE: {
    field: "title",
    message: "This role is outside Ops, Systems, Automation, RevOps, Product Ops, or Chief of Staff.",
  },
  CAT_LOW_CONF: {
    field: "title",
    message: "Say the Ops / Systems work more clearly in the title and first lines of the description.",
  },
  SALARY_MISSING: { field: "salary", message: "Add a salary range with numbers." },
  APPLY_MISSING: { field: "applyUrl", message: "Add a working apply URL or email." },
  DESCRIPTION_THIN: { field: "description", message: "Add more scope: responsibilities and requirements (about 280+ characters)." },
  METADATA_WEAK: { field: "description", message: "Add company, apply link, and a fuller description." },
};

const EMPLOYER_IGNORE = new Set(["SOURCE_WEAK", "ONSITE_ONLY", "REMOTE_UNCLEAR"]);

async function aiNicheNote(title: string, description: string): Promise<{ onNiche: boolean; note: string } | null> {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You screen job listings for CareersPal, a board for Ops, Systems, Automation, RevOps, Product Ops, and Chief of Staff roles only.
Reply with one JSON object: {"onNiche":true|false,"note":"short fix for the employer if false"}.
No markdown. Title: ${title.slice(0, 180)}
Description: ${description.slice(0, 900)}`,
    });
    const text = (response.text || "").trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as { onNiche?: boolean; note?: string };
    return {
      onNiche: Boolean(parsed.onNiche),
      note: String(parsed.note || "").slice(0, 160),
    };
  } catch {
    return null;
  }
}

export async function screenListingForBoard(
  job: ListingReviewInput,
  opts?: { skipAi?: boolean },
): Promise<ListingReviewResult> {
  const title = String(job.title || "").trim();
  const description = String(job.description || "").trim();
  const issues: ScreenIssue[] = [];

  if (title.length < 4) issues.push({ field: "title", message: "Enter a job title." });
  if (!hasSalary(job.salary)) issues.push({ field: "salary", message: "Add a salary range with numbers." });
  if (!isWorkingApply(job.apply_url)) issues.push({ field: "applyUrl", message: "Add a working apply URL or email." });
  if (!String(job.company || "").trim()) issues.push({ field: "company", message: "Add the company name." });
  if (description.length < 40) issues.push({ field: "description", message: "Add a short description of the role." });

  const scored = scoreCandidate({
    title,
    company_name: job.company || null,
    apply_url: job.apply_url || null,
    job_url: job.apply_url || null,
    location_text: job.location || null,
    remote_policy: job.remote_policy || null,
    description_clean: description,
    salary_present: hasSalary(job.salary),
    source_type: "direct_custom",
  });

  scored.reasons.forEach((code) => {
    if (EMPLOYER_IGNORE.has(code)) return;
    const copy = REASON_COPY[code];
    if (copy && !issues.some((item) => item.message === copy.message)) issues.push(copy);
  });

  const blocking = scored.reasons.filter((code) => {
    if (EMPLOYER_IGNORE.has(code)) return false;
    return REASON_SEVERITY[code as ReasonCode] === "BLOCK" || code === "DESCRIPTION_THIN" || code === "CAT_LOW_CONF" || code === "METADATA_WEAK";
  });

  const ai = opts?.skipAi ? null : await aiNicheNote(title, description);
  if (ai && !ai.onNiche) {
    issues.push({ field: "title", message: ai.note || "This looks off-niche for CareersPal." });
  }

  const unique = issues.filter((item, index) => issues.findIndex((other) => other.field === item.field && other.message === item.message) === index);
  const ok = unique.length === 0 && blocking.length === 0 && (!ai || ai.onNiche);

  return {
    decision: ok ? "publish" : "hold",
    reasons: unique.map((item) => item.message),
    issues: unique,
    score: scored.total,
    aiNote: ai?.note,
  };
}

export async function reviewListingForPublish(
  job: ListingReviewInput,
  opts?: { skipAi?: boolean },
): Promise<ListingReviewResult> {
  return screenListingForBoard(job, opts);
}

export async function maybeAutoPublishListing(
  sb: SupabaseClient<any, "public", any>,
  jobId: string,
  actorId?: string | null,
  opts?: { skipAi?: boolean },
): Promise<{ status: "published" | "pending_review"; reasons: string[]; issues: ScreenIssue[]; aiNote?: string }> {
  const { data } = await sb
    .from("jobs")
    .select("id,title,description,category,salary,apply_url,location,remote_policy,stripe_payment_status,plan_price,created_by,plan_type,status,companies(name)")
    .eq("id", jobId)
    .maybeSingle();
  if (!data) {
    return { status: "pending_review", reasons: ["Job not found."], issues: [] };
  }

  const row = data as ListingReviewInput & { companies?: { name?: string | null } | Array<{ name?: string | null }> | null };
  const company = Array.isArray(row.companies) ? row.companies[0]?.name : row.companies?.name;
  const paymentStatus = String(row.stripe_payment_status || "");
  const isPaid = paymentStatus === "paid" || paymentStatus === "founding";
  const isFree = row.plan_price === 0;
  if (!isPaid && !isFree) {
    return { status: "pending_review", reasons: ["Payment not confirmed."], issues: [] };
  }

  const review = await screenListingForBoard({ ...row, company }, { skipAi: opts?.skipAi });
  await sb.from("audit_logs").insert({
    action: "listing_auto_review",
    job_id: jobId,
    actor_id: actorId || null,
    metadata: { decision: review.decision, reasons: review.reasons, score: review.score, aiNote: review.aiNote || null },
  });

  if (review.decision !== "publish") {
    return { status: "pending_review", reasons: review.reasons, issues: review.issues, aiNote: review.aiNote };
  }

  const planType = String(row.plan_type || "");
  const previous = String(row.status || "draft");
  await sb
    .from("jobs")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      posted_at_text: "Just now",
      timestamp: Date.now(),
      is_featured: planType === "Featured Pro" || planType === "Elite Managed",
    })
    .eq("id", jobId);

  await sb.from("audit_logs").insert({
    action: "status_updated",
    job_id: jobId,
    actor_id: actorId || null,
    metadata: { status: "published", previousStatus: previous, via: "auto_review" },
  });

  return { status: "published", reasons: [], issues: [], aiNote: review.aiNote };
}
