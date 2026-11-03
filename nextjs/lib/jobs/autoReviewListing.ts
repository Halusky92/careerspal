import { GoogleGenAI } from "@google/genai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isOnNicheJob } from "../nicheScope";

export type ListingReviewInput = {
  id: string;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  salary?: string | null;
  apply_url?: string | null;
  stripe_payment_status?: string | null;
  plan_price?: number | null;
  created_by?: string | null;
  plan_type?: string | null;
};

export type ListingReviewResult = {
  decision: "publish" | "hold";
  reasons: string[];
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

async function aiNicheNote(title: string, description: string): Promise<{ onNiche: boolean; note: string } | null> {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You screen job listings for CareersPal, a board for Ops, Systems, Automation, RevOps, Product Ops, and Chief of Staff roles only.
Reply with one JSON object: {"onNiche":true|false,"note":"max 12 words"}.
No markdown. Title: ${title.slice(0, 180)}
Description: ${description.slice(0, 800)}`,
    });
    const text = (response.text || "").trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as { onNiche?: boolean; note?: string };
    return {
      onNiche: Boolean(parsed.onNiche),
      note: String(parsed.note || "").slice(0, 120),
    };
  } catch {
    return null;
  }
}

export async function reviewListingForPublish(
  job: ListingReviewInput,
  opts?: { skipAi?: boolean },
): Promise<ListingReviewResult> {
  const title = String(job.title || "").trim();
  const description = String(job.description || "").trim();
  const reasons: string[] = [];
  if (title.length < 4) reasons.push("Title is too short.");
  if (!hasSalary(job.salary)) reasons.push("Salary is missing.");
  if (!isWorkingApply(job.apply_url)) reasons.push("Apply link is missing.");
  if (description.length < 40) reasons.push("Description is too short.");
  if (!isOnNicheJob({ title, category: job.category, description })) {
    reasons.push("Title is outside Ops / Systems / Automation.");
  }

  const ai = opts?.skipAi ? null : await aiNicheNote(title, description);
  if (ai && !ai.onNiche) reasons.push(ai.note || "AI: off-niche.");

  return {
    decision: reasons.length === 0 ? "publish" : "hold",
    reasons,
    aiNote: ai?.note,
  };
}

export async function maybeAutoPublishListing(
  sb: SupabaseClient<any, "public", any>,
  jobId: string,
  actorId?: string | null,
  opts?: { skipAi?: boolean },
): Promise<{ status: "published" | "pending_review"; reasons: string[]; aiNote?: string }> {
  const { data } = await sb
    .from("jobs")
    .select("id,title,description,category,salary,apply_url,stripe_payment_status,plan_price,created_by,plan_type,status")
    .eq("id", jobId)
    .maybeSingle();
  if (!data || String((data as ListingReviewInput).status || "") !== "pending_review") {
    return { status: "pending_review", reasons: ["Not waiting for review."] };
  }

  const job = data as ListingReviewInput;
  const paymentStatus = String(job.stripe_payment_status || "");
  const isPaid = paymentStatus === "paid" || paymentStatus === "founding";
  const isFree = job.plan_price === 0;
  if (!isPaid && !isFree) {
    return { status: "pending_review", reasons: ["Payment not confirmed."] };
  }

  const review = await reviewListingForPublish(job, { skipAi: opts?.skipAi });
  await sb.from("audit_logs").insert({
    action: "listing_auto_review",
    job_id: jobId,
    actor_id: actorId || null,
    metadata: { decision: review.decision, reasons: review.reasons, aiNote: review.aiNote || null },
  });

  if (review.decision !== "publish") {
    return { status: "pending_review", reasons: review.reasons, aiNote: review.aiNote };
  }

  const planType = String(job.plan_type || "");
  await sb
    .from("jobs")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      posted_at_text: "Just now",
      timestamp: Date.now(),
      is_featured: planType === "Featured Pro" || planType === "Elite Managed",
    })
    .eq("id", jobId)
    .eq("status", "pending_review");

  await sb.from("audit_logs").insert({
    action: "status_updated",
    job_id: jobId,
    actor_id: actorId || null,
    metadata: { status: "published", previousStatus: "pending_review", via: "auto_review" },
  });

  return { status: "published", reasons: [], aiNote: review.aiNote };
}
