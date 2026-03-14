import { NextResponse } from "next/server";
import { getSupabaseProfile } from "../../../../../lib/supabaseServerAuth";
import { enrichCompanyFromWebsite } from "../../../../../lib/companyEnrichment";
import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";

function pickWebsiteFromRow(row: { company_website?: string | null; apply_url?: string | null } | null): string | null {
  const rawWebsite = (row as any)?.company_website || null;
  const rawApply = (row as any)?.apply_url || null;
  const pick = (value: string | null) => {
    const v = (value || "").trim();
    if (!v || v === "#" || v.startsWith("mailto:") || v.startsWith("/")) return null;
    try {
      const u = new URL(v);
      return `${u.protocol}//${u.hostname}`;
    } catch {
      return null;
    }
  };
  return pick(rawWebsite) || pick(rawApply);
}

export async function POST(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as { slug?: string; description?: string; longDescription?: string };
  const slug = (body.slug || "").toString().trim().toLowerCase();
  if (!slug || slug === "undefined" || slug === "null") {
    return NextResponse.json({ error: "Missing slug." }, { status: 400 });
  }

  // 1) Find canonical company row.
  let { data: company } = await supabaseAdmin
    .from("companies")
    .select("id,name,slug,website,description,long_description,logo_url,location,employee_count,verified,updated_at")
    .eq("slug", slug)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!company) {
    const nameGuess = slug.replace(/-/g, " ").trim();
    const { data: byName } = await supabaseAdmin
      .from("companies")
      .select("id,name,slug,website,description,long_description,logo_url,location,employee_count,verified,updated_at")
      .ilike("name", nameGuess)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (byName?.id) company = byName as any;
  }

  if (!company?.id) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  const before = company;
  const canonicalId = company.id as string;

  // Optional manual override (admin-only): set official copy (trust-first).
  // This is used to match manual admin-post quality without inventing facts.
  try {
    const overrideDesc = (body.description || "").toString().trim();
    const overrideLong = (body.longDescription || "").toString().trim();
    if (overrideDesc || overrideLong) {
      const patch: Record<string, unknown> = {};
      if (overrideDesc) patch.description = overrideDesc;
      if (overrideLong) patch.long_description = overrideLong;
      await supabaseAdmin.from("companies").update(patch).eq("id", canonicalId);
      Object.assign(company as any, patch);
    }
  } catch {
    // ignore
  }

  // 2) Relink jobs from duplicate company rows (same name, case-insensitive exact match).
  let relinkedJobs = 0;
  const companyName = ((company as any).name || "").toString().trim();
  if (companyName) {
    const { data: dupes } = await supabaseAdmin
      .from("companies")
      .select("id,name,slug,updated_at")
      .ilike("name", companyName)
      .order("updated_at", { ascending: false })
      .limit(50);
    const dupeIds = (dupes || []).map((d: any) => d?.id).filter(Boolean) as string[];
    if (dupeIds.length > 1) {
      const { data: updated } = await supabaseAdmin
        .from("jobs")
        .update({ company_id: canonicalId })
        .in("company_id", dupeIds)
        .neq("company_id", canonicalId)
        .select("id");
      relinkedJobs = (updated || []).length;
    }
  }

  // 3) Ensure slug set (only if missing).
  if (!((company as any).slug || "").toString().trim()) {
    await supabaseAdmin.from("companies").update({ slug }).eq("id", canonicalId);
    (company as any).slug = slug;
  }

  // 4) Derive website from latest published job if missing.
  let derivedWebsite = ((company as any).website || "").toString().trim() || null;
  if (!derivedWebsite) {
    const { data: jobRow } = await supabaseAdmin
      .from("jobs")
      .select("company_website,apply_url")
      .eq("company_id", canonicalId)
      .eq("status", "published")
      .order("timestamp", { ascending: false })
      .limit(1)
      .maybeSingle();
    derivedWebsite = pickWebsiteFromRow(jobRow as any);
    if (derivedWebsite) {
      await supabaseAdmin.from("companies").update({ website: derivedWebsite }).eq("id", canonicalId);
      (company as any).website = derivedWebsite;
    }
  }

  // 5) Enrich from website (meta + JSON-LD), conservative: fill missing only.
  const patch: Record<string, unknown> = {};
  const website = ((company as any).website || "").toString().trim();
  if (website) {
    const enr = await enrichCompanyFromWebsite({ websiteUrl: website });
    if (!((company as any).description || "").toString().trim() && enr.description) patch.description = enr.description;
    if (!((company as any).long_description || "").toString().trim() && enr.description) patch.long_description = enr.description;
    if (!((company as any).logo_url || "").toString().trim() && enr.logo_url) patch.logo_url = enr.logo_url;
    if (!((company as any).location || "").toString().trim() && (enr as any).location) patch.location = (enr as any).location;
    if (Object.keys(patch).length > 0) {
      await supabaseAdmin.from("companies").update(patch).eq("id", canonicalId);
      Object.assign(company as any, patch);
    }

    // 6) Backfill job-level company fields for parity with manual admin posts (only fill missing).
    try {
      const jobPatch: Record<string, unknown> = {};
      const desc = ((company as any).description || "").toString().trim();
      const logo = ((company as any).logo_url || "").toString().trim();
      const web = ((company as any).website || "").toString().trim();
      if (desc) jobPatch.company_description = desc;
      if (logo) jobPatch.logo_url = logo;
      if (web) jobPatch.company_website = web;
      if (Object.keys(jobPatch).length > 0) {
        await supabaseAdmin
          .from("jobs")
          .update(jobPatch)
          .eq("company_id", canonicalId)
          .eq("status", "published");
      }
    } catch {
      // ignore
    }

    return NextResponse.json({
      ok: true,
      slug,
      companyId: canonicalId,
      relinkedJobs,
      patch,
      enrichmentNotes: (enr as any).notes || [],
      before,
      after: company,
    });
  }

  return NextResponse.json({ ok: true, slug, companyId: canonicalId, relinkedJobs, patch, before, after: company });
}

