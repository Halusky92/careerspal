import { NextResponse } from "next/server";
import { checkRateLimit } from "../../../../../lib/rateLimit";
import { screenListingForBoard } from "../../../../../lib/jobs/autoReviewListing";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0]?.trim() || "unknown";
  const limiter = checkRateLimit(`listing-screen:${ip}`, { windowMs: 60_000, max: 20 });
  if (!limiter.allowed) {
    return NextResponse.json({ error: "Too many checks. Wait a moment." }, { status: 429 });
  }

  const body = (await request.json()) as {
    title?: string;
    description?: string;
    salary?: string;
    applyUrl?: string;
    company?: string;
    location?: string;
    remotePolicy?: string;
    category?: string;
  };

  const result = await screenListingForBoard({
    title: body.title,
    description: body.description,
    salary: body.salary,
    apply_url: body.applyUrl,
    company: body.company,
    location: body.location,
    remote_policy: body.remotePolicy,
    category: body.category,
  });

  return NextResponse.json({
    ok: result.decision === "publish",
    issues: result.issues,
    reasons: result.reasons,
    score: result.score,
    aiNote: result.aiNote || null,
  });
}
