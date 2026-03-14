import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../../lib/supabaseAdmin";
import { getSupabaseProfile } from "../../../../../../lib/supabaseServerAuth";
import { matchDenylistHost } from "../../../../../../lib/sourcing/denylist";
import { normalizeHost, normalizeUrlForRegistry } from "../../../../../../lib/sourcing/domain";
import { detectAndParseSalaryForGreenhouse, parseSalaryFromText } from "../../../../../../lib/sourcing/normalization/salary";
import { stripHtmlToText } from "../../../../../../lib/sourcing/normalization/text";

export const runtime = "nodejs";

type CandidateRow = {
  id: string;
  job_url: string | null;
  apply_url: string | null;
  salary_present: boolean | null;
  salary_confidence: string | null;
  provenance: any;
  publish_status: string | null;
  published_job_id: string | null;
  created_at: string | null;
};

const clampInt = (n: unknown, min: number, max: number, fallback: number) => {
  const v = typeof n === "number" ? n : Number.parseInt(String(n ?? ""), 10);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(v)));
};

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
      if (u.includes("year") || u === "yr" || u === "annually" || u === "annual") return "year";
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
    if (!currency || !period || !amountMin) return null;

    return {
      salary_text_raw:
        amountMax && amountMax !== amountMin ? `${currency} ${amountMin}-${amountMax} ${period}` : `${currency} ${amountMin} ${period}`,
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
    return (t.includes("salary") || t.includes("base salary") || t.includes("annual base")) && (s.includes("$") || t.includes(" usd") || t.includes("eur") || t.includes("gbp"));
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
    for (const k of Object.keys(node)) walk((node as any)[k], depth + 1);
  };

  walk(root, 0);
  return out;
}

function getLastAttemptAtIso(provenance: any): string | null {
  if (!provenance || typeof provenance !== "object") return null;
  const ts =
    provenance?.salary_enrichment_attempt?.attempted_at ||
    provenance?.salary_enrichment?.fetched_at ||
    provenance?.salary_enrichment?.fetchedAt ||
    null;
  return typeof ts === "string" && ts ? ts : null;
}

async function asyncPool<T, R>(concurrency: number, items: T[], iterator: (item: T, idx: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const workers = new Array(Math.max(1, concurrency)).fill(null).map(async () => {
    while (true) {
      const idx = nextIndex++;
      if (idx >= items.length) return;
      results[idx] = await iterator(items[idx], idx);
    }
  });

  await Promise.all(workers);
  return results;
}

async function fetchAndParseSalary(urlToFetch: string) {
  const norm = normalizeUrlForRegistry(urlToFetch);
  const host = normalizeHost(norm.host);
  if (!host) return { ok: false as const, kind: "invalid_host" as const, error: "Invalid URL host." };

  const deny = matchDenylistHost(host);
  if (deny.matched) {
    return { ok: false as const, kind: "blocked" as const, error: `Blocked by denylist: ${deny.matchDomain || host}` };
  }

  let res: Response;
  try {
    res = await fetch(norm.normalizedUrl, {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
  } catch {
    return { ok: false as const, kind: "fetch_failed" as const, error: "Fetch failed." };
  }

  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  if (!res.ok) {
    return { ok: false as const, kind: "fetch_failed" as const, error: `Fetch failed (${res.status}).` };
  }
  if (!contentType.includes("text/html")) {
    return { ok: false as const, kind: "unsupported_type" as const, error: `Unsupported content-type: ${contentType || "unknown"}` };
  }

  const html = await readTextUpTo(res, 2_000_000);

  const parsedJsonLd = parseSalaryFromJsonLd(html);
  if (parsedJsonLd?.salary_present) {
    return {
      ok: true as const,
      kind: "found" as const,
      parsed: parsedJsonLd,
      fetchedUrl: (res.url || norm.normalizedUrl).toString(),
      contentType,
      parsePath: "jsonld" as const,
    };
  }

  const nextData = extractNextDataJson(html);
  if (nextData) {
    try {
      const obj = JSON.parse(nextData);
      const strings = findSalaryLikeStringsInObject(obj, 400);
      for (const s of strings) {
        const p = parseSalaryFromText(s);
        if (p.salary_present) {
          return {
            ok: true as const,
            kind: "found" as const,
            parsed: {
              ...p,
              salary_detected_from: "official_json",
              salary_parse_notes: ["next_data_string_match"].concat((p as any).salary_parse_notes || []),
            },
            fetchedUrl: (res.url || norm.normalizedUrl).toString(),
            contentType,
            parsePath: "next_data" as const,
          };
        }
      }
    } catch {
      // ignore invalid next data json
    }
  }

  const text = stripHtmlToText(html);
  const parsed = detectAndParseSalaryForGreenhouse(text);
  if (!parsed.salary_present) {
    return {
      ok: true as const,
      kind: "not_found" as const,
      fetchedUrl: (res.url || norm.normalizedUrl).toString(),
      contentType,
      debug: {
        html_has_annual_base_salary: /annual\s+base\s+salary/i.test(html),
        text_has_annual_base_salary: /annual\s+base\s+salary/i.test(text),
        has_jsonld: extractJsonLdBlocks(html).length > 0,
        has_next_data: Boolean(nextData),
      },
    };
  }

  return {
    ok: true as const,
    kind: "found" as const,
    parsed,
    fetchedUrl: (res.url || norm.normalizedUrl).toString(),
    contentType,
    parsePath: "text" as const,
  };
}

export async function POST(request: Request) {
  const auth = await getSupabaseProfile(request);
  if (auth?.profile?.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 500 });
  }
  const sb = supabaseAdmin;

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const sourceId = typeof body.sourceId === "string" ? body.sourceId.trim() : "";
  const runId = typeof body.runId === "string" ? body.runId.trim() : "";
  const limit = clampInt(body.limit, 1, 80, 30);
  const concurrency = clampInt(body.concurrency, 1, 5, 3);
  const cooldownHours = clampInt(body.cooldownHours, 0, 168, 24);

  // Safety: if the admin didn’t narrow by run or source, keep scans small.
  const scanLimit = clampInt(body.scanLimit, 50, 600, sourceId || runId ? Math.max(150, limit * 6) : 80);

  let q = sb
    .from("sourcing_sourced_job_candidates")
    .select("id,job_url,apply_url,salary_present,salary_confidence,provenance,publish_status,published_job_id,created_at")
    .is("published_job_id", null)
    .order("created_at", { ascending: false })
    .limit(scanLimit);
  if (sourceId) q = q.eq("source_id", sourceId);
  if (runId) q = q.eq("source_run_id", runId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: `Unable to load candidates: ${error.message}` }, { status: 500 });

  const now = Date.now();
  const cooldownMs = cooldownHours * 60 * 60 * 1000;

  const rows: CandidateRow[] = (data || []) as any;
  const toAttempt = rows
    .filter((c) => {
      const salaryPresent = Boolean((c as any).salary_present);
      const confidence = ((c as any).salary_confidence || "unknown").toString();
      if (salaryPresent && (confidence === "high" || confidence === "medium")) return false;

      const urlToFetch = ((c as any).job_url || (c as any).apply_url || "").toString().trim();
      if (!urlToFetch) return false;

      const lastAttemptIso = getLastAttemptAtIso((c as any).provenance);
      if (!lastAttemptIso || cooldownMs <= 0) return true;
      const t = Date.parse(lastAttemptIso);
      if (!Number.isFinite(t)) return true;
      return now - t >= cooldownMs;
    })
    .slice(0, limit);

  const skippedRecent = Math.max(0, rows.filter((c) => !!getLastAttemptAtIso((c as any).provenance)).length - toAttempt.length);

  const results = await asyncPool(concurrency, toAttempt, async (c) => {
    const id = (c as any).id as string;
    const urlToFetch = (((c as any).job_url || (c as any).apply_url) ?? "").toString().trim();
    const prevProv = (c as any).provenance;
    const provObj = prevProv && typeof prevProv === "object" ? (prevProv as Record<string, unknown>) : {};

    const shouldReopenForPublish =
      ((c as any).published_job_id == null) && (((c as any).publish_status || "").toString() === "skipped_not_eligible");

    const parsed = await fetchAndParseSalary(urlToFetch);

    if (!parsed.ok) {
      await sb
        .from("sourcing_sourced_job_candidates")
        .update({
          provenance: {
            ...provObj,
            salary_enrichment_attempt: {
              attempted_at: new Date().toISOString(),
              input_url: urlToFetch,
              result: parsed.kind,
              error: parsed.error,
            },
          },
        })
        .eq("id", id);
      return { id, status: "failed", reason: parsed.kind };
    }

    if (parsed.kind === "not_found") {
      await sb
        .from("sourcing_sourced_job_candidates")
        .update({
          provenance: {
            ...provObj,
            salary_enrichment_attempt: {
              attempted_at: new Date().toISOString(),
              input_url: urlToFetch,
              fetched_url: parsed.fetchedUrl,
              content_type: parsed.contentType || null,
              result: "salary_not_found",
              debug: parsed.debug || null,
            },
          },
        })
        .eq("id", id);
      return { id, status: "not_found" };
    }

    const salary = parsed.parsed;
    const enrichment = {
      fetched_url: parsed.fetchedUrl,
      fetched_at: new Date().toISOString(),
      content_type: parsed.contentType || null,
      salary_text_raw: salary.salary_text_raw,
      salary_parse_notes: salary.salary_parse_notes,
      parse_path: parsed.parsePath,
    };

    const { error: upErr } = await sb
      .from("sourcing_sourced_job_candidates")
      .update({
        salary_text_raw: salary.salary_text_raw,
        salary_amount_min: salary.salary_amount_min,
        salary_amount_max: salary.salary_amount_max,
        salary_currency: salary.salary_currency,
        salary_period: salary.salary_period,
        salary_present: salary.salary_present,
        salary_confidence: salary.salary_confidence,
        salary_detected_from: salary.salary_detected_from,
        provenance: { ...provObj, salary_enrichment: enrichment },
        ...(shouldReopenForPublish
          ? {
              publish_status: "not_published",
              publish_notes: "Reopened after salary enrichment.",
            }
          : {}),
      })
      .eq("id", id);

    if (upErr) return { id, status: "failed", reason: "update_failed" };
    return { id, status: "updated", reopened: shouldReopenForPublish };
  });

  const updated = results.filter((r: any) => r.status === "updated").length;
  const reopened = results.filter((r: any) => r.status === "updated" && r.reopened).length;
  const notFound = results.filter((r: any) => r.status === "not_found").length;
  const failed = results.filter((r: any) => r.status === "failed").length;

  return NextResponse.json({
    ok: true,
    scanned: rows.length,
    attempted: toAttempt.length,
    skipped_recent: skippedRecent,
    updated,
    reopened,
    not_found: notFound,
    failed,
    limit,
    concurrency,
    cooldownHours,
  });
}

