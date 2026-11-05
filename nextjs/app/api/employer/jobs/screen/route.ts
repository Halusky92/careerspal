import { NextResponse } from "next/server";
import { checkRateLimit } from "../../../../../lib/rateLimit";
import { screenListingForBoard } from "../../../../../lib/jobs/autoReviewListing";
import { localListingIssues, type ListingFields } from "../../../../../lib/jobs/listingFieldChecks";
import { signScreenPass } from "../../../../../lib/jobs/screenPass";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0]?.trim() || "unknown";
  const limiter = checkRateLimit(`listing-screen:${ip}`, { windowMs: 60_000, max: 60 });
  if (!limiter.allowed) {
    const waitSec = Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      { error: `Too many checks. Try again in ${waitSec}s.`, retryAfterSec: waitSec },
      { status: 429 },
    );
  }

  const body = (await request.json()) as ListingFields & { field?: string; mode?: string };
  const fields: ListingFields = {
    title: body.title,
    description: body.description,
    salary: body.salary,
    applyUrl: body.applyUrl,
    company: body.company,
    location: body.location,
    remotePolicy: body.remotePolicy,
    category: body.category,
  };

  const mode = body.mode || body.field || "all";
  if (mode !== "all" && mode !== "niche") {
    const allIssues = localListingIssues(fields);
    const issues = mode === "fields" ? allIssues : allIssues.filter((issue) => issue.field === mode);
    const ok = issues.length === 0;
    return NextResponse.json({
      ok,
      issues,
      reasons: issues.map((item) => item.message),
      token: null,
      aiNote: null,
    });
  }

  if (mode === "niche") {
    const local = localListingIssues(fields).filter(
      (issue) =>
        (issue.field === "title" || issue.field === "description") &&
        !/company|apply link|apply url|careers url/i.test(issue.message),
    );
    if (local.length) {
      return NextResponse.json({ ok: false, issues: local, reasons: local.map((item) => item.message), token: null, aiNote: null });
    }
  }

  const result = await screenListingForBoard(fields, { aiOnly: mode === "niche" });
  const ok = result.decision === "publish";
  return NextResponse.json({
    ok,
    issues: result.issues,
    reasons: result.reasons,
    score: result.score,
    aiNote: result.aiNote || null,
    token: ok ? signScreenPass(fields) : null,
  });
}
