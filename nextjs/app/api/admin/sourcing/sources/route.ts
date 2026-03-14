import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../../lib/supabaseServerAuth";
import { validateSourceUrlV2 } from "../../../../../lib/sourcing/validatorV2";

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
    .from("sourcing_sources")
    .select("id,company_id,display_name,base_url,normalized_url,source_type,validation_state,validation_confidence,enabled,created_at,approved_at,approval_decision,companies(name,slug)")
    .order("created_at", { ascending: false })
    .range(0, 499);

  if (error) {
    return NextResponse.json({ error: "Unable to load sources." }, { status: 500 });
  }

  return NextResponse.json({ sources: data || [] });
}

export async function POST(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const body = (await request.json()) as { baseUrl?: string; companyId?: string | null; displayName?: string | null };
  const baseUrl = (body.baseUrl || "").trim();
  const companyId = (body.companyId || null)?.toString() || null;
  const displayName = (body.displayName || "").trim() || null;

  if (!baseUrl) {
    return NextResponse.json({ error: "Missing baseUrl." }, { status: 400 });
  }

  // Load approved registrable domains for company if provided (safe allowlist).
  let allowedDomains: string[] = [];
  if (companyId) {
    const { data: domains } = await supabaseAdmin
      .from("company_allowed_domains")
      .select("registrable_domain")
      .eq("company_id", companyId)
      .eq("status", "approved");
    allowedDomains = (domains || []).map((d) => (d.registrable_domain || "").toString());
  }

  const v = await validateSourceUrlV2(baseUrl, allowedDomains);
  const detectedType = v.detected_ats_type || (v.domain_match_type === "employer_domain_match" ? "direct_custom" : "unknown");

  const insert = {
    company_id: companyId,
    display_name: displayName,
    base_url: baseUrl,
    normalized_url: v.normalized_careers_url,
    source_type: detectedType,
    validation_state: v.source_validation_result,
    validation_confidence: v.source_validation_confidence,
    validator_output: v,
    ats_detection_output: { detected_ats_type: v.detected_ats_type, ats_identifier: v.ats_identifier },
    ats_identifier: v.ats_identifier,
    enabled: false,
    last_validated_at: new Date().toISOString(),
    created_by: auth.profile.id,
  };

  const { data: source, error } = await supabaseAdmin
    .from("sourcing_sources")
    .insert(insert)
    .select("id,validation_state,source_type,normalized_url")
    .single();

  if (error || !source) {
    return NextResponse.json({ error: "Unable to create source." }, { status: 500 });
  }

  // Auto-create a review item for anything not explicitly allowed.
  let reviewId: string | null = null;
  if (source.validation_state !== "allowed") {
    const { data: review } = await supabaseAdmin
      .from("sourcing_source_reviews")
      .insert({
        source_id: source.id,
        status: "open",
        evidence_snapshot: v,
        created_by: auth.profile.id,
      })
      .select("id")
      .single();
    reviewId = (review?.id as string | undefined) || null;
  }

  return NextResponse.json({ sourceId: source.id, reviewId });
}

export async function PATCH(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as { sourceId?: string; enabled?: boolean };
  const sourceId = (body.sourceId || "").trim();
  const enabled = body.enabled === true;

  if (!sourceId) {
    return NextResponse.json({ error: "Missing sourceId." }, { status: 400 });
  }

  const { data: src, error: srcErr } = await supabaseAdmin
    .from("sourcing_sources")
    .select("id,validation_state,source_type,enabled")
    .eq("id", sourceId)
    .maybeSingle();

  if (srcErr) {
    return NextResponse.json({ error: "Unable to load source." }, { status: 500 });
  }
  if (!src) {
    return NextResponse.json({ error: "Source not found." }, { status: 404 });
  }

  if (enabled) {
    if (src.validation_state !== "allowed") {
      return NextResponse.json({ error: "Source must be allowed before enabling." }, { status: 400 });
    }
    if ((src.source_type || "").toString() === "unknown") {
      return NextResponse.json({ error: "Cannot enable unknown source type." }, { status: 400 });
    }
  }

  const { error: updErr } = await supabaseAdmin.from("sourcing_sources").update({ enabled }).eq("id", sourceId);
  if (updErr) {
    return NextResponse.json({ error: "Unable to update source." }, { status: 500 });
  }

  return NextResponse.json({ success: true, sourceId, enabled });
}
