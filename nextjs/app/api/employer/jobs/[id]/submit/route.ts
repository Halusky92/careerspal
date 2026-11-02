import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../../lib/supabaseAdmin";
import { getFoundingStatus, loadEmployerOwnedJob, requireEmployer } from "../../../../../../lib/employer";
import { foundingExpiresAt } from "../../../../../../lib/founding";
import { isOnNicheJob } from "../../../../../../lib/nicheScope";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireEmployer(request);
  if ("error" in auth) return auth.error;
  const { id } = await context.params;
  const owned = await loadEmployerOwnedJob(id, auth.profileId);
  if (!owned.job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const title = String(owned.job.title || "").trim();
  const salary = String(owned.job.salary || "").trim();
  const applyUrl = String(owned.job.apply_url || "").trim();
  if (!title || !salary || !applyUrl || applyUrl === "#") {
    return NextResponse.json(
      { error: "Title, salary, and a working apply link are required before review." },
      { status: 400 },
    );
  }
  if (!isOnNicheJob({ title, category: null, description: owned.job.description as string | null })) {
    return NextResponse.json(
      { error: "This board is for Ops, Systems, Automation, RevOps, Product Ops, and Chief of Staff roles." },
      { status: 400 },
    );
  }

  const founding = await getFoundingStatus(auth.profileId);
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

  const payload: Record<string, unknown> = {
    status: "pending_review",
    posted_at_text: "Pending review",
    stripe_payment_status: "founding",
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
    metadata: { status: "pending_review" },
  });

  return NextResponse.json({ ok: true, status: "pending_review", jobId: data.id });
}
