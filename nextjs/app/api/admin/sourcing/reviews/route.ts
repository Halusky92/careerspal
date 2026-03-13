import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../../lib/supabaseServerAuth";
import { inferGreenhouseBoardTokenFromUrl } from "../../../../../lib/sourcing/connectors/greenhouse";
import { normalizeUrlForRegistry } from "../../../../../lib/sourcing/domain";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin
    .from("sourcing_source_reviews")
    .select(
      "id,status,decision,decision_reason_codes,notes,reviewer_id,reviewed_at,created_at,source_id,sourcing_sources(id,company_id,display_name,base_url,normalized_url,source_type,validation_state,validation_confidence)",
    )
    .order("created_at", { ascending: false })
    .range(0, 499);

  if (error) {
    return NextResponse.json({ error: "Unable to load reviews." }, { status: 500 });
  }

  return NextResponse.json({ reviews: data || [] });
}

export async function PATCH(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const body = (await request.json()) as {
    reviewId?: string;
    decision?:
      | "approve_as_official_source"
      | "approve_as_official_ats"
      | "approve_as_direct_custom"
      | "reject_third_party"
      | "hold";
    reasonCodes?: unknown;
    notes?: string;
  };

  const reviewId = (body.reviewId || "").trim();
  const decision = body.decision;
  if (!reviewId || !decision) {
    return NextResponse.json({ error: "Missing reviewId/decision." }, { status: 400 });
  }

  const decision_reason_codes = Array.isArray(body.reasonCodes) ? body.reasonCodes : null;
  const notes = (body.notes || "").trim() || null;

  const status =
    decision === "hold" ? "held" : decision === "reject_third_party" ? "rejected" : "approved";

  const { data: updatedReview, error: reviewErr } = await supabaseAdmin
    .from("sourcing_source_reviews")
    .update({
      status,
      decision,
      decision_reason_codes,
      notes,
      reviewer_id: auth.profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", reviewId)
    .select("id,source_id,status,decision")
    .single();

  if (reviewErr || !updatedReview) {
    return NextResponse.json({ error: "Unable to update review." }, { status: 500 });
  }

  // Mirror decision onto the source record (foundation only; no connectors yet).
  const { data: sourceRow } = await supabaseAdmin
    .from("sourcing_sources")
    .select("id,source_type,base_url,normalized_url,ats_identifier,validator_output")
    .eq("id", updatedReview.source_id)
    .maybeSingle();

  const baseOrNormalizedUrl = ((sourceRow as any)?.base_url || (sourceRow as any)?.normalized_url || "").toString();
  const norm = baseOrNormalizedUrl ? normalizeUrlForRegistry(baseOrNormalizedUrl) : null;
  const inputHostFromEvidence = ((sourceRow as any)?.validator_output?.input_host || "").toString().toLowerCase().trim();
  const isCanonicalGreenhouse =
    (norm?.host === "boards.greenhouse.io" || norm?.host === "boards.eu.greenhouse.io") ||
    inputHostFromEvidence === "boards.greenhouse.io" ||
    inputHostFromEvidence === "boards.eu.greenhouse.io";

  const sourceUpdate: Record<string, unknown> = {
    approved_by: auth.profile.id,
    approved_at: new Date().toISOString(),
    approval_notes: notes,
  };

  if (decision === "approve_as_official_ats") {
    sourceUpdate.approval_decision = "approved_as_official_ats";
    sourceUpdate.validation_state = "allowed";
    // MVP: approved ATS sources are runnable immediately (still admin-only).
    sourceUpdate.enabled = true;
    // Consistency: if the ATS is clearly Greenhouse canonical, ensure we do not leave it as "unknown".
    if (isCanonicalGreenhouse) {
      sourceUpdate.source_type = "greenhouse";
      const existingId = ((sourceRow as any)?.ats_identifier || "").toString().trim();
      sourceUpdate.ats_identifier = existingId || inferGreenhouseBoardTokenFromUrl(((sourceRow as any)?.normalized_url || (sourceRow as any)?.base_url || "").toString()) || null;
    }
  } else if (decision === "approve_as_direct_custom") {
    sourceUpdate.approval_decision = "approved_as_direct_custom";
    sourceUpdate.validation_state = "allowed";
  } else if (decision === "approve_as_official_source") {
    sourceUpdate.approval_decision = "approved_as_official_source";
    sourceUpdate.validation_state = "allowed";
  } else if (decision === "reject_third_party") {
    sourceUpdate.approval_decision = "rejected_third_party";
    sourceUpdate.validation_state = "denied";
    sourceUpdate.enabled = false;
  } else if (decision === "hold") {
    sourceUpdate.approval_decision = "held";
    sourceUpdate.validation_state = "hold";
    sourceUpdate.enabled = false;
  }

  await supabaseAdmin.from("sourcing_sources").update(sourceUpdate).eq("id", updatedReview.source_id);

  return NextResponse.json({ success: true, review: updatedReview });
}

