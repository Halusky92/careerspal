import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../../lib/supabaseAdmin";
import { getFoundingStatus, loadEmployerOwnedJob, requireEmployer } from "../../../../../../lib/employer";
import { foundingExpiresAt } from "../../../../../../lib/founding";
import { maybeNotifyStartPackTwoLeft, sendListingOutcomeEmails } from "../../../../../../lib/listingNotify";
import { screenListingForBoard } from "../../../../../../lib/jobs/autoReviewListing";
import { createJobSlug } from "../../../../../../lib/jobs";
import { verifyScreenPass } from "../../../../../../lib/jobs/screenPass";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireEmployer(request);
  if ("error" in auth) return auth.error;
  const rawBody = await request.text();
  let screenToken: string | undefined;
  try {
    screenToken = rawBody ? (JSON.parse(rawBody) as { screenToken?: string }).screenToken : undefined;
  } catch {
    screenToken = undefined;
  }
  const { id } = await context.params;
  const owned = await loadEmployerOwnedJob(id, auth.profileId);
  if (!owned.job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const planType = String(owned.job.plan_type || "Standard");
  const planPrice = typeof owned.job.plan_price === "number" ? owned.job.plan_price : null;
  if (planType !== "Standard" || (planPrice !== null && planPrice !== 0 && planPrice >= 79)) {
    return NextResponse.json(
      { error: "Checkout is required for this listing.", checkoutRequired: true },
      { status: 402 },
    );
  }

  const founding = await getFoundingStatus(auth.profileId, {
    email: auth.email,
    companyId: owned.job.company_id,
    companyName: owned.job.company_description,
  });
  if (!founding.eligible) {
    return NextResponse.json(
      {
        error: "Checkout is required for this listing.",
        checkoutRequired: true,
        reason: founding.reason,
      },
      { status: 402 },
    );
  }

  let companyName: string | null = owned.job.company_description || null;
  if (owned.job.company_id) {
    const { data: named } = await supabaseAdmin!
      .from("companies")
      .select("name")
      .eq("id", owned.job.company_id)
      .maybeSingle();
    companyName = named?.name || companyName;
  }

  const listingFields = {
    title: owned.job.title,
    description: owned.job.description,
    salary: owned.job.salary,
    apply_url: owned.job.apply_url,
    company: companyName,
    category: null,
  };
  const skipAi = verifyScreenPass(screenToken, listingFields);
  const screen = await screenListingForBoard(listingFields, { skipAi });
  if (screen.decision !== "publish") {
    return NextResponse.json(
      {
        error: screen.reasons[0] || "This listing does not meet the board bar yet.",
        issues: screen.issues,
        reasons: screen.reasons,
      },
      { status: 400 },
    );
  }

  const payload: Record<string, unknown> = {
    status: "pending_review",
    posted_at_text: "Pending review",
    stripe_payment_status: "founding",
    plan_type: "Standard",
    plan_price: 0,
    origin: "employer",
  };
  let { data, error } = await supabaseAdmin!
    .from("jobs")
    .update(payload)
    .eq("id", id)
    .select("id,status,company_id")
    .single();
  if (error) {
    const { origin: _origin, ...withoutOrigin } = payload;
    const retry = await supabaseAdmin!
      .from("jobs")
      .update(withoutOrigin)
      .eq("id", id)
      .select("id,status,company_id")
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Unable to submit listing." }, { status: 500 });
  }

  if (data.company_id) {
    const { data: company } = await supabaseAdmin!
      .from("companies")
      .select("id,founding_expires_at")
      .eq("id", data.company_id)
      .maybeSingle();
    const expires = company?.founding_expires_at;
    const stillValid = expires && new Date(expires).getTime() > Date.now();
    if (!stillValid) {
      await supabaseAdmin!
        .from("companies")
        .update({ founding_expires_at: foundingExpiresAt(), claimed_by: auth.profileId })
        .eq("id", data.company_id);
    }
  }

  await supabaseAdmin!.from("audit_logs").insert({
    action: "employer_job_submitted_founding",
    job_id: id,
    actor_id: auth.profileId,
    metadata: { status: "pending_review", plan: "Start pack", planPrice: 0 },
  });

  await sendListingOutcomeEmails({
    jobId: data.id,
    title: owned.job.title,
    companyName,
    planType: "Standard",
    planPrice: 0,
    buyerEmail: auth.email || null,
    startPack: true,
    live: false,
    paid: false,
  });

  const remainingAfter = Math.max(0, (founding.remainingJobs || 1) - 1);
  await maybeNotifyStartPackTwoLeft({
    profileId: auth.profileId,
    email: auth.email || null,
    remainingAfter,
    usedAfter: (founding.usedJobs || 0) + 1,
    quota: founding.quota,
    nextPrice: founding.nextPrice,
    jobId: data.id,
  });

  return NextResponse.json({
    ok: true,
    status: "pending_review",
    jobId: data.id,
    slug: createJobSlug({ id: data.id, title: owned.job.title || "role" }),
    plan: "Start pack",
    remainingJobs: remainingAfter,
    usedJobs: (founding.usedJobs || 0) + 1,
    quota: founding.quota,
  });
}
