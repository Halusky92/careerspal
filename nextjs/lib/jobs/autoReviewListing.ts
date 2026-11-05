import { GoogleGenAI } from "@google/genai";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  localBlockingReasons,
  localListingIssues,
  type ListingFields,
  type ScreenIssue,
} from "./listingFieldChecks";

export type { ScreenIssue };

export type ListingReviewInput = ListingFields & {
  id?: string;
  stripe_payment_status?: string | null;
  plan_price?: number | null;
  created_by?: string | null;
  plan_type?: string | null;
  status?: string | null;
};

export type ListingReviewResult = {
  decision: "publish" | "hold";
  reasons: string[];
  issues: ScreenIssue[];
  score: number;
  aiNote?: string;
};

async function parseJsonObject(text: string): Promise<Record<string, unknown> | null> {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function aiSafetyNote(title: string, description: string): Promise<{ safe: boolean; note: string } | null> {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You check a job listing for harmful copy. Flag it if it contains hate, racism, antisemitism, Islamophobia, religious hatred, homophobia, transphobia, sexism, harassment, threats, sexual exploitation, scams, or calls to violence.
Ordinary hiring rules are fine (work authorization, language, location, years of experience) unless they are clearly hateful.
Reply with one JSON object: {"safe":true|false,"note":"one short sentence if unsafe, empty if safe"}.
No markdown.
Title: ${title.slice(0, 180)}
Description: ${description.slice(0, 1200)}`,
    });
    const parsed = await parseJsonObject((response.text || "").trim());
    if (!parsed) return null;
    return {
      safe: parsed.safe !== false,
      note: String(parsed.note || "").slice(0, 180),
    };
  } catch {
    return null;
  }
}

async function aiNicheNote(title: string, description: string): Promise<{ onNiche: boolean; note: string } | null> {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return null;
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You screen job listings for CareersPal, a board for Ops, Systems, Automation, RevOps, Product Ops, and Chief of Staff roles only.
If the title already names one of those, onNiche is true unless the description is clearly a different job (sales AE, software engineer, nurse, warehouse, etc.).
Reply with one JSON object: {"onNiche":true|false,"note":"one short sentence telling the employer exactly what to change if false"}.
No markdown. Title: ${title.slice(0, 180)}
Description: ${description.slice(0, 900)}`,
    });
    const parsed = await parseJsonObject((response.text || "").trim());
    if (!parsed) return null;
    return {
      onNiche: Boolean(parsed.onNiche),
      note: String(parsed.note || "").slice(0, 180),
    };
  } catch {
    return null;
  }
}

export async function screenListingForBoard(
  job: ListingReviewInput,
  opts?: { skipAi?: boolean; aiOnly?: boolean },
): Promise<ListingReviewResult> {
  const title = String(job.title || "").trim();
  const description = String(job.description || "").trim();
  const issues = opts?.aiOnly ? [] : localListingIssues(job);
  const blocking = opts?.aiOnly ? [] : localBlockingReasons(job);

  const localOk = issues.length === 0 && blocking.length === 0;
  const [ai, safety] = await Promise.all([
    opts?.skipAi || (!opts?.aiOnly && !localOk) ? Promise.resolve(null) : aiNicheNote(title, description),
    title.length >= 4 && description.length >= 1 ? aiSafetyNote(title, description) : Promise.resolve(null),
  ]);
  const descriptionNag = (note?: string) =>
    /complete job description|responsibilit|requirement|too short|more detail|fuller description|outlines the/i.test(
      note || "",
    );

  if (ai && !ai.onNiche && !descriptionNag(ai.note)) {
    issues.push({
      field: "title",
      message: ai.note || "Change the title so this is clearly an Ops / Systems role.",
    });
  }
  if (safety && !safety.safe) {
    issues.push({
      field: "description",
      message: safety.note || "Remove hateful or abusive language from this listing.",
    });
  }

  const unique = issues.filter(
    (item, index) => issues.findIndex((other) => other.field === item.field && other.message === item.message) === index,
  );
  const nicheOk = !ai || ai.onNiche || descriptionNag(ai.note);
  const ok = unique.length === 0 && blocking.length === 0 && nicheOk && (!safety || safety.safe);

  return {
    decision: ok ? "publish" : "hold",
    reasons: unique.map((item) => item.message),
    issues: unique,
    score: ok ? 1 : 0,
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
