import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../../../../lib/supabaseServerAuth";
import { matchDenylistHost } from "../../../../../../../lib/sourcing/denylist";
import { normalizeHost, normalizeUrlForRegistry } from "../../../../../../../lib/sourcing/domain";
import { detectAndParseSalaryForGreenhouse } from "../../../../../../../lib/sourcing/normalization/salary";
import { stripHtmlToText } from "../../../../../../../lib/sourcing/normalization/text";

export const runtime = "nodejs";

async function readTextUpTo(response: Response, limitBytes = 250_000): Promise<string> {
  if (!response.body) return await response.text();
  const decoder = new TextDecoder("utf-8");
  let out = "";
  let read = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = response.body;
  for await (const chunk of body) {
    const u8 = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
    read += u8.byteLength;
    out += decoder.decode(u8, { stream: true });
    if (read >= limitBytes) break;
  }
  return out;
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }

  const params = await ctx.params;
  const id = (params.id || "").trim();
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const { data: candidate, error: candErr } = await supabaseAdmin
    .from("sourcing_sourced_job_candidates")
    .select("id,job_url,apply_url,salary_present,salary_confidence,provenance")
    .eq("id", id)
    .single();

  if (candErr || !candidate) {
    return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
  }

  const salaryPresent = Boolean((candidate as any).salary_present);
  const salaryConfidence = ((candidate as any).salary_confidence || "unknown").toString();
  if (salaryPresent && (salaryConfidence === "high" || salaryConfidence === "medium")) {
    return NextResponse.json({ ok: true, updated: false, reason: "already_has_salary" });
  }

  const urlToFetch = ((candidate as any).job_url || (candidate as any).apply_url || "").toString().trim();
  if (!urlToFetch) {
    return NextResponse.json({ error: "Missing job_url/apply_url." }, { status: 400 });
  }

  const norm = normalizeUrlForRegistry(urlToFetch);
  const host = normalizeHost(norm.host);
  if (!host) return NextResponse.json({ error: "Invalid URL host." }, { status: 400 });

  const deny = matchDenylistHost(host);
  if (deny.matched) {
    return NextResponse.json({ error: `Blocked by denylist: ${deny.matchDomain || host}` }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(norm.normalizedUrl, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent": "CareersPalSourcingSalaryEnricher/1.0",
      },
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "Fetch failed." }, { status: 502 });
  }

  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  if (!res.ok) {
    return NextResponse.json({ error: `Fetch failed (${res.status}).` }, { status: 502 });
  }
  if (!contentType.includes("text/html")) {
    return NextResponse.json({ error: `Unsupported content-type: ${contentType || "unknown"}` }, { status: 400 });
  }

  const html = await readTextUpTo(res, 250_000);
  const text = stripHtmlToText(html);
  const parsed = detectAndParseSalaryForGreenhouse(text);

  if (!parsed.salary_present) {
    return NextResponse.json({
      ok: true,
      updated: false,
      reason: "salary_not_found",
      parsed: {
        salary_present: parsed.salary_present,
        salary_confidence: parsed.salary_confidence,
        salary_parse_notes: parsed.salary_parse_notes,
        salary_text_raw: parsed.salary_text_raw,
      },
    });
  }

  const prevProv = (candidate as any).provenance;
  const provObj = prevProv && typeof prevProv === "object" ? (prevProv as Record<string, unknown>) : {};
  const enrichment = {
    fetched_url: (res.url || norm.normalizedUrl).toString(),
    fetched_at: new Date().toISOString(),
    content_type: contentType || null,
    salary_text_raw: parsed.salary_text_raw,
    salary_parse_notes: parsed.salary_parse_notes,
  };

  const { data: updated, error: upErr } = await supabaseAdmin
    .from("sourcing_sourced_job_candidates")
    .update({
      salary_text_raw: parsed.salary_text_raw,
      salary_amount_min: parsed.salary_amount_min,
      salary_amount_max: parsed.salary_amount_max,
      salary_currency: parsed.salary_currency,
      salary_period: parsed.salary_period,
      salary_present: parsed.salary_present,
      salary_confidence: parsed.salary_confidence,
      salary_detected_from: parsed.salary_detected_from,
      provenance: { ...provObj, salary_enrichment: enrichment },
    })
    .eq("id", id)
    .select("id,salary_present,salary_confidence,salary_text_raw,salary_amount_min,salary_amount_max,salary_currency,salary_period,salary_detected_from")
    .single();

  if (upErr || !updated) {
    return NextResponse.json({ error: "Unable to update candidate salary." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: true, candidate: updated });
}

