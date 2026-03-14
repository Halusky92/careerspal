import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../../../../lib/supabaseServerAuth";
import { matchDenylistHost } from "../../../../../../../lib/sourcing/denylist";
import { normalizeHost, normalizeUrlForRegistry } from "../../../../../../../lib/sourcing/domain";
import { detectAndParseSalaryForGreenhouse, parseSalaryFromText } from "../../../../../../../lib/sourcing/normalization/salary";
import { stripHtmlToText } from "../../../../../../../lib/sourcing/normalization/text";

export const runtime = "nodejs";

// Some employer job pages are long; keep a hard cap, but large enough to include compensation sections.
async function readTextUpTo(response: Response, limitBytes = 2_000_000): Promise<string> {
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

function extractJsonLdBlocks(html: string): string[] {
  const raw = (html || "").toString();
  if (!raw) return [];
  const out: string[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const payload = (m[1] || "").trim();
    if (payload) out.push(payload);
  }
  return out;
}

function parseSalaryFromJsonLd(html: string) {
  const blocks = extractJsonLdBlocks(html);
  if (!blocks.length) return null;

  const trySalaryObj = (obj: any) => {
    if (!obj || typeof obj !== "object") return null;
    const base = obj.baseSalary || obj.estimatedSalary || null;
    if (!base) return null;

    // Schema.org JobPosting baseSalary patterns.
    // baseSalary: { currency, value: { minValue, maxValue, unitText } }
    // or baseSalary: { currency, value: number }
    const currency = (base.currency || base.currencyCode || base.currency_code || "").toString().trim();
    const value = base.value ?? base;
    const minValue = value?.minValue ?? value?.min_value ?? value?.value?.minValue ?? null;
    const maxValue = value?.maxValue ?? value?.max_value ?? value?.value?.maxValue ?? null;
    const singleValue = typeof value === "number" ? value : value?.value;
    const unitTextRaw = (value?.unitText ?? value?.unit_text ?? base.unitText ?? "").toString().trim().toLowerCase();

    const unitToPeriod = (u: string) => {
      if (!u) return null;
      if (u.includes("hour")) return "hour";
      if (u.includes("day")) return "day";
      if (u.includes("month")) return "month";
      if (u.includes("year") || u === "yr" || u === "year" || u === "annually" || u === "annual") return "year";
      if (u === "h") return "hour";
      if (u === "d") return "day";
      if (u === "m") return "month";
      if (u === "y") return "year";
      return null;
    };

    const period = unitToPeriod(unitTextRaw);
    const min = Number.isFinite(Number(minValue)) ? Math.round(Number(minValue)) : null;
    const max = Number.isFinite(Number(maxValue)) ? Math.round(Number(maxValue)) : null;
    const single = Number.isFinite(Number(singleValue)) ? Math.round(Number(singleValue)) : null;

    const amountMin = min ?? single;
    const amountMax = max ?? null;

    // If JSON-LD doesn't give us a clean structure, bail.
    if (!currency || !period || !amountMin) return null;

    return {
      salary_text_raw:
        amountMax && amountMax !== amountMin
          ? `${currency} ${amountMin}-${amountMax} ${period}`
          : `${currency} ${amountMin} ${period}`,
      salary_amount_min: amountMin,
      salary_amount_max: amountMax,
      salary_currency: currency.toUpperCase(),
      salary_period: period as any,
      salary_present: true,
      salary_confidence: "high" as const,
      salary_detected_from: "official_json" as const,
      salary_parse_notes: ["jsonld_baseSalary"],
    };
  };

  const walk = (node: any, depth = 0): any | null => {
    if (!node || depth > 12) return null;
    const direct = trySalaryObj(node);
    if (direct) return direct;
    if (Array.isArray(node)) {
      for (const it of node) {
        const r = walk(it, depth + 1);
        if (r) return r;
      }
    } else if (typeof node === "object") {
      // Common JSON-LD patterns: @graph
      if (node["@graph"]) {
        const r = walk(node["@graph"], depth + 1);
        if (r) return r;
      }
      for (const k of Object.keys(node)) {
        const v = (node as any)[k];
        if (v && (typeof v === "object" || Array.isArray(v))) {
          const r = walk(v, depth + 1);
          if (r) return r;
        }
      }
    }
    return null;
  };

  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block);
      const r = walk(parsed, 0);
      if (r) return r;
    } catch {
      // ignore invalid JSON-LD
    }
  }
  return null;
}

function extractNextDataJson(html: string): string | null {
  const raw = (html || "").toString();
  if (!raw) return null;
  const m = raw.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  const payload = (m?.[1] || "").trim();
  return payload || null;
}

function findSalaryLikeStringsInObject(root: any, maxStrings = 400): string[] {
  const out: string[] = [];
  const seen = new Set<any>();

  const looksSalaryish = (s: string) => {
    const t = s.toLowerCase();
    return (
      (t.includes("salary") || t.includes("base salary") || t.includes("annual base")) &&
      (s.includes("$") || t.includes(" usd") || t.includes("eur") || t.includes("gbp"))
    );
  };

  const walk = (node: any, depth = 0) => {
    if (out.length >= maxStrings) return;
    if (!node || depth > 12) return;
    if (typeof node === "string") {
      const s = node.trim();
      if (s && s.length <= 800 && looksSalaryish(s)) out.push(s);
      return;
    }
    if (typeof node !== "object") return;
    if (seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const it of node) walk(it, depth + 1);
      return;
    }
    for (const k of Object.keys(node)) {
      const v = (node as any)[k];
      walk(v, depth + 1);
    }
  };

  walk(root, 0);
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
    .select("id,job_url,apply_url,salary_present,salary_confidence,provenance,publish_status,published_job_id")
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
        // Use a browser-like UA; some job pages return JS-only shells or bot-blocked HTML to unknown agents.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
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

  const html = await readTextUpTo(res, 2_000_000);

  // 1) Prefer structured data when present (JSON-LD JobPosting baseSalary).
  const parsedJsonLd = parseSalaryFromJsonLd(html);
  if (parsedJsonLd?.salary_present) {
    const { data: updated, error: upErr } = await supabaseAdmin
      .from("sourcing_sourced_job_candidates")
      .update({
        salary_text_raw: parsedJsonLd.salary_text_raw,
        salary_amount_min: parsedJsonLd.salary_amount_min,
        salary_amount_max: parsedJsonLd.salary_amount_max,
        salary_currency: parsedJsonLd.salary_currency,
        salary_period: parsedJsonLd.salary_period,
        salary_present: parsedJsonLd.salary_present,
        salary_confidence: parsedJsonLd.salary_confidence,
        salary_detected_from: parsedJsonLd.salary_detected_from,
        provenance: {
          ...(typeof (candidate as any).provenance === "object" && (candidate as any).provenance ? (candidate as any).provenance : {}),
          salary_enrichment: {
            fetched_url: (res.url || norm.normalizedUrl).toString(),
            fetched_at: new Date().toISOString(),
            content_type: contentType || null,
            salary_text_raw: parsedJsonLd.salary_text_raw,
            salary_parse_notes: parsedJsonLd.salary_parse_notes,
            parse_path: "jsonld",
          },
        },
      })
      .eq("id", id)
      .select(
        "id,salary_present,salary_confidence,salary_text_raw,salary_amount_min,salary_amount_max,salary_currency,salary_period,salary_detected_from"
      )
      .single();

    if (upErr || !updated) {
      return NextResponse.json({ error: "Unable to update candidate salary." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, updated: true, candidate: updated });
  }

  // 2) If the site is Next.js and renders salary from __NEXT_DATA__, try parsing salary-ish strings from it.
  const nextData = extractNextDataJson(html);
  if (nextData) {
    try {
      const obj = JSON.parse(nextData);
      const strings = findSalaryLikeStringsInObject(obj, 400);
      for (const s of strings) {
        const p = parseSalaryFromText(s);
        if (p.salary_present) {
          const { data: updated, error: upErr } = await supabaseAdmin
            .from("sourcing_sourced_job_candidates")
            .update({
              salary_text_raw: p.salary_text_raw,
              salary_amount_min: p.salary_amount_min,
              salary_amount_max: p.salary_amount_max,
              salary_currency: p.salary_currency,
              salary_period: p.salary_period,
              salary_present: p.salary_present,
              salary_confidence: p.salary_confidence,
              salary_detected_from: "official_json",
              provenance: {
                ...(typeof (candidate as any).provenance === "object" && (candidate as any).provenance ? (candidate as any).provenance : {}),
                salary_enrichment: {
                  fetched_url: (res.url || norm.normalizedUrl).toString(),
                  fetched_at: new Date().toISOString(),
                  content_type: contentType || null,
                  salary_text_raw: p.salary_text_raw,
                  salary_parse_notes: ["next_data_string_match"].concat(p.salary_parse_notes || []),
                  parse_path: "next_data",
                },
              },
            })
            .eq("id", id)
            .select(
              "id,salary_present,salary_confidence,salary_text_raw,salary_amount_min,salary_amount_max,salary_currency,salary_period,salary_detected_from"
            )
            .single();

          if (upErr || !updated) {
            return NextResponse.json({ error: "Unable to update candidate salary." }, { status: 500 });
          }
          return NextResponse.json({ ok: true, updated: true, candidate: updated });
        }
      }
    } catch {
      // ignore invalid next data json
    }
  }

  // 3) Fallback: parse visible text content.
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
      debug: {
        fetched_url: (res.url || norm.normalizedUrl).toString(),
        html_has_annual_base_salary: /annual\s+base\s+salary/i.test(html),
        text_has_annual_base_salary: /annual\s+base\s+salary/i.test(text),
        has_jsonld: extractJsonLdBlocks(html).length > 0,
        has_next_data: Boolean(nextData),
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

  const shouldReopenForPublish =
    ((candidate as any).published_job_id == null) && (((candidate as any).publish_status || "").toString() === "skipped_not_eligible");

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
      ...(shouldReopenForPublish
        ? {
            publish_status: "not_published",
            publish_notes: "Reopened after salary enrichment.",
          }
        : {}),
    })
    .eq("id", id)
    .select("id,salary_present,salary_confidence,salary_text_raw,salary_amount_min,salary_amount_max,salary_currency,salary_period,salary_detected_from")
    .single();

  if (upErr || !updated) {
    return NextResponse.json({ error: "Unable to update candidate salary." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: true, candidate: updated });
}

