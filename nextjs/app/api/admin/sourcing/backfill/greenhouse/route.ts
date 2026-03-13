import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../../../lib/supabaseServerAuth";
import { inferGreenhouseBoardTokenFromUrl } from "../../../../../../lib/sourcing/connectors/greenhouse";
import { normalizeUrlForRegistry } from "../../../../../../lib/sourcing/domain";

export const runtime = "nodejs";

type SourceRow = {
  id: string;
  base_url: string;
  normalized_url: string;
  source_type: string;
  ats_identifier: string | null;
  validator_output?: any;
};

export async function POST(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as { limit?: number; dryRun?: boolean };
  const limit = Math.min(500, Math.max(1, Number(body.limit) || 200));
  const dryRun = Boolean(body.dryRun);

  const { data, error } = await supabaseAdmin
    .from("sourcing_sources")
    .select("id,base_url,normalized_url,source_type,ats_identifier,validator_output")
    .or("source_type.eq.unknown,ats_identifier.is.null")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: "Unable to load sources." }, { status: 500 });
  }

  const rows = (data as SourceRow[] | null) || [];
  const candidates = rows
    .map((r) => {
      const url = (r.normalized_url || r.base_url || "").toString();
      const host = url ? normalizeUrlForRegistry(url).host : "";
      const inputHost = (r.validator_output?.input_host || "").toString().toLowerCase().trim();
      const isCanonicalGreenhouse =
        host === "boards.greenhouse.io" ||
        host === "boards.eu.greenhouse.io" ||
        inputHost === "boards.greenhouse.io" ||
        inputHost === "boards.eu.greenhouse.io";

      if (!isCanonicalGreenhouse) return null;

      const token = (r.ats_identifier || "").toString().trim() || inferGreenhouseBoardTokenFromUrl(url) || null;
      if (!token) return null;

      return { id: r.id, token };
    })
    .filter(Boolean) as Array<{ id: string; token: string }>;

  let updated = 0;
  const updatedIds: string[] = [];
  const errorsOut: Array<{ id: string; error: string }> = [];

  if (!dryRun) {
    for (const c of candidates) {
      const { error: upErr } = await supabaseAdmin
        .from("sourcing_sources")
        .update({ source_type: "greenhouse", ats_identifier: c.token })
        .eq("id", c.id);
      if (upErr) {
        errorsOut.push({ id: c.id, error: upErr.message });
        continue;
      }
      updated += 1;
      updatedIds.push(c.id);
    }
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    scanned: rows.length,
    matched: candidates.length,
    updated,
    updatedIds: updatedIds.slice(0, 50),
    errors: errorsOut.slice(0, 20),
  });
}

