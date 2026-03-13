import { matchDenylistHost } from "./denylist";
import { getRegistrableDomain, normalizeHost, normalizeUrlForRegistry } from "./domain";
import type { DetectionConfidence, SourceManualReviewReason, SourceValidatorOutput } from "./types";

type AtsType = "greenhouse" | "lever" | "ashby" | "workable" | "unknown";

const ATS_CANONICAL_HOSTS: Record<Exclude<AtsType, "unknown">, (host: string) => boolean> = {
  greenhouse: (h) => h === "boards.greenhouse.io" || h === "boards.eu.greenhouse.io",
  lever: (h) => h === "jobs.lever.co",
  ashby: (h) => h === "jobs.ashbyhq.com",
  workable: (h) => h === "apply.workable.com" || h.endsWith(".workable.com"),
};

const ATS_CLUE_PATTERNS: Array<{ type: Exclude<AtsType, "unknown">; clue: string; test: (html: string) => boolean }> = [
  { type: "greenhouse", clue: "html:boards-api.greenhouse.io", test: (h) => h.includes("boards-api.greenhouse.io") },
  { type: "greenhouse", clue: "html:boards.greenhouse.io", test: (h) => h.includes("boards.greenhouse.io") },
  { type: "lever", clue: "html:api.lever.co", test: (h) => h.includes("api.lever.co/v0/postings") || h.includes("api.lever.co") },
  { type: "lever", clue: "html:jobs.lever.co", test: (h) => h.includes("jobs.lever.co") },
  { type: "ashby", clue: "html:ashbyhq.com", test: (h) => h.includes("ashbyhq.com") },
  { type: "workable", clue: "html:workable.com", test: (h) => h.includes("workable.com") || h.includes("apply.workable.com") },
];

const HTML_THIRD_PARTY_INDICATORS = [
  "linkedin.com/jobs",
  "indeed.com",
  "glassdoor.com",
  "ziprecruiter.com",
  "weworkremotely.com",
  "remoteok.com",
  "remotive.com",
  "himalayas.app",
  "wellfound.com",
  "builtin.com",
  "jooble.org",
  "talent.com",
  "simplyhired.com",
  "adzuna.",
];

function detectAtsFromHost(host: string): { type: AtsType; confidence: DetectionConfidence; clue: string | null } {
  const h = normalizeHost(host);
  if (!h) return { type: "unknown", confidence: "unknown", clue: null };
  for (const [type, fn] of Object.entries(ATS_CANONICAL_HOSTS) as Array<[Exclude<AtsType, "unknown">, (h: string) => boolean]>) {
    if (fn(h)) return { type, confidence: "high", clue: "host:ats_canonical" };
  }
  return { type: "unknown", confidence: "unknown", clue: null };
}

function extractAtsIdentifierFromUrl(type: Exclude<AtsType, "unknown">, normalizedUrl: string): string | null {
  try {
    const url = new URL(normalizedUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    if (type === "greenhouse" && parts.length >= 1) return parts[0];
    if (type === "lever" && parts.length >= 1) return parts[0];
    if (type === "workable" && url.host === "apply.workable.com" && parts.length >= 1) return parts[0];
    if (type === "ashby" && url.host === "jobs.ashbyhq.com" && parts.length >= 1) return parts[0];
    return null;
  } catch {
    return null;
  }
}

function extractAtsIdentifierFromHtml(html: string): { type: Exclude<AtsType, "unknown">; identifier: string } | null {
  // Greenhouse: boards-api.greenhouse.io/v1/boards/{token}/jobs
  const gh = html.match(/boards-api\.greenhouse\.io\/v1\/boards\/([a-z0-9_-]+)\/jobs/i);
  if (gh?.[1]) return { type: "greenhouse", identifier: gh[1] };

  // Lever: api.lever.co/v0/postings/{company}
  const lever = html.match(/api\.lever\.co\/v0\/postings\/([a-z0-9_-]+)/i);
  if (lever?.[1]) return { type: "lever", identifier: lever[1] };

  // Ashby: jobs.ashbyhq.com/{company}
  const ashby = html.match(/jobs\.ashbyhq\.com\/([a-z0-9_-]+)/i);
  if (ashby?.[1]) return { type: "ashby", identifier: ashby[1] };

  // Workable: apply.workable.com/{company}
  const workable = html.match(/apply\.workable\.com\/([a-z0-9_-]+)\b/i);
  if (workable?.[1]) return { type: "workable", identifier: workable[1] };

  return null;
}

async function readTextUpTo(response: Response, limitBytes = 200_000): Promise<string> {
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

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m?.[1]) return null;
  return m[1].replace(/\s+/g, " ").trim().slice(0, 160);
}

function detectAtsFromHtml(html: string): { type: AtsType; confidence: DetectionConfidence; clues: string[]; atsIdentifier: string | null } {
  const low = html.toLowerCase();
  const clues: string[] = [];
  const hits: Record<string, number> = {};
  for (const p of ATS_CLUE_PATTERNS) {
    if (p.test(low)) {
      clues.push(p.clue);
      hits[p.type] = (hits[p.type] || 0) + 1;
    }
  }
  const best = Object.entries(hits).sort((a, b) => b[1] - a[1])[0]?.[0] as Exclude<AtsType, "unknown"> | undefined;
  const multi = Object.keys(hits).length > 1;
  const idFromHtml = extractAtsIdentifierFromHtml(low);

  if (!best && !idFromHtml) return { type: "unknown", confidence: "unknown", clues, atsIdentifier: null };

  const type = idFromHtml?.type || best || "unknown";
  const confidence: DetectionConfidence = multi ? "low" : type !== "unknown" ? "medium" : "unknown";
  const atsIdentifier = idFromHtml?.identifier || null;
  if (multi) clues.push("html:multi_ats_signals");
  if (atsIdentifier) clues.push(`html:ats_identifier:${type}`);
  return { type, confidence, clues, atsIdentifier };
}

function scanHtmlForThirdPartyIndicators(html: string): string[] {
  const low = html.toLowerCase();
  const hits: string[] = [];
  for (const token of HTML_THIRD_PARTY_INDICATORS) {
    if (low.includes(token)) hits.push(token);
  }
  return Array.from(new Set(hits)).slice(0, 12);
}

async function resolveRedirectsAndFetch(
  inputUrl: string,
): Promise<{
  redirect_hops: SourceValidatorOutput["redirect_hops"];
  redirect_chain: string[];
  finalUrl: string;
  finalHost: string;
  finalRegistrable: string;
  fetch_status: number | null;
  content_type: string | null;
  page_title: string | null;
  html_clues: string[];
  html_detected_ats_type: AtsType;
  html_detected_ats_confidence: DetectionConfidence;
  html_ats_identifier: string | null;
  html_multi_ats_signals: boolean;
  deny_indicators_in_html: string[];
}> {
  const { normalizedUrl } = normalizeUrlForRegistry(inputUrl);
  const hops: NonNullable<SourceValidatorOutput["redirect_hops"]> = [];
  const chain: string[] = [normalizedUrl];

  let current = normalizedUrl;
  let statusFinal: number | null = null;
  let contentType: string | null = null;
  let title: string | null = null;
  let htmlClues: string[] = [];
  let htmlAtsType: AtsType = "unknown";
  let htmlAtsConfidence: DetectionConfidence = "unknown";
  let htmlAtsIdentifier: string | null = null;
  let htmlMulti = false;
  let denyIndicators: string[] = [];

  for (let i = 0; i < 5; i += 1) {
    let res: Response;
    try {
      res = await fetch(current, {
        method: "GET",
        redirect: "manual",
        headers: {
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "User-Agent": "CareersPalSourcingValidator/2.0",
        },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      statusFinal = null;
      break;
    }

    const fromHost = normalizeHost(new URL(current).host);
    const fromReg = getRegistrableDomain(fromHost);
    const deny = matchDenylistHost(fromHost);

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      const next = loc ? new URL(loc, current).toString() : null;
      const toHost = next ? normalizeHost(new URL(next).host) : null;
      const toReg = toHost ? getRegistrableDomain(toHost) : null;
      const denyTo = toHost ? matchDenylistHost(toHost) : { matched: false as const };
      hops.push({
        from_url: current,
        to_url: next,
        status: res.status,
        from_host: fromHost,
        to_host: toHost,
        from_registrable_domain: fromReg,
        to_registrable_domain: toReg,
        denylist_match: Boolean(deny.matched || denyTo.matched),
        denylist_match_domain: (deny.matchDomain as string | undefined) || (denyTo.matchDomain as string | undefined) || null,
      });
      if (!next) break;
      current = next;
      chain.push(current);
      continue;
    }

    statusFinal = res.status;
    contentType = res.headers.get("content-type");

    if (contentType && contentType.toLowerCase().includes("text/html")) {
      const html = await readTextUpTo(res, 200_000);
      title = extractTitle(html);
      const ats = detectAtsFromHtml(html);
      htmlClues = ats.clues;
      htmlAtsType = ats.type;
      htmlAtsConfidence = ats.confidence;
      htmlAtsIdentifier = ats.atsIdentifier;
      htmlMulti = ats.clues.includes("html:multi_ats_signals");
      denyIndicators = scanHtmlForThirdPartyIndicators(html);
    }

    break;
  }

  const finalHost = normalizeHost(new URL(current).host);
  const finalRegistrable = getRegistrableDomain(finalHost);

  return {
    redirect_hops: hops,
    redirect_chain: chain,
    finalUrl: current,
    finalHost,
    finalRegistrable,
    fetch_status: statusFinal,
    content_type: contentType,
    page_title: title,
    html_clues: htmlClues,
    html_detected_ats_type: htmlAtsType,
    html_detected_ats_confidence: htmlAtsConfidence,
    html_ats_identifier: htmlAtsIdentifier,
    html_multi_ats_signals: htmlMulti,
    deny_indicators_in_html: denyIndicators,
  };
}

export async function validateSourceUrlV2(inputUrl: string, employerRegistrableDomains: string[] = []): Promise<SourceValidatorOutput> {
  const normalizedEmployerDomains = employerRegistrableDomains.map((d) => (d || "").trim().toLowerCase()).filter(Boolean);

  const normalized = normalizeUrlForRegistry(inputUrl);
  const input_host = normalized.host;
  const input_registrable_domain = normalized.registrableDomain;

  const fetched = await resolveRedirectsAndFetch(inputUrl);

  const final_host = fetched.finalHost;
  const final_registrable_domain = fetched.finalRegistrable;
  const final_url_after_redirects = fetched.finalUrl;

  // Denylist checks: final host + any deny hits inside hops.
  const denyFinal = matchDenylistHost(final_host);
  const denyHop = (fetched.redirect_hops || []).find((h) => h.denylist_match);
  const denyHtml = fetched.deny_indicators_in_html && fetched.deny_indicators_in_html.length > 0;

  if (denyFinal.matched || denyHop) {
    return {
      source_allowed: false,
      source_validation_result: "denied",
      source_validation_confidence: "high",
      source_validation_reason: ["DENYLIST_MATCH"],
      normalized_careers_url: normalized.normalizedUrl,
      final_url_after_redirects,
      redirect_chain: fetched.redirect_chain,
      redirect_hops: fetched.redirect_hops,
      input_host,
      input_registrable_domain,
      final_host,
      final_registrable_domain,
      matched_employer_domain: null,
      matched_ats_domain: null,
      detected_third_party_domain: (denyFinal.matchDomain as string | undefined) || denyHop?.denylist_match_domain || null,
      detected_ats_type: null,
      ats_identifier: null,
      domain_match_type: "third_party_denylist_match",
      denylist_match: true,
      denylist_match_domain: (denyFinal.matchDomain as string | undefined) || denyHop?.denylist_match_domain || null,
      needs_manual_review: false,
      manual_review_reason: ["DENYLIST_HIT_IN_CHAIN"],
      notes: ["Blocked: denylist match (host or redirect chain)."],
      fetch_status: fetched.fetch_status,
      content_type: fetched.content_type,
      page_title: fetched.page_title,
      evidence_clues: fetched.html_clues,
      denylist_indicators_in_html: fetched.deny_indicators_in_html,
    };
  }

  // IMPORTANT: canonical ATS host detection should consider the ORIGINAL input host too.
  // Some official ATS board URLs (e.g. Greenhouse) can redirect to an employer domain while still being a Greenhouse board.
  const atsInputHost = detectAtsFromHost(input_host);
  const atsIdFromInputUrl =
    atsInputHost.type !== "unknown" ? extractAtsIdentifierFromUrl(atsInputHost.type, normalized.normalizedUrl) : null;

  // Host-based ATS detection (high confidence).
  const atsHost = detectAtsFromHost(final_host);
  const atsIdFromUrl =
    atsHost.type !== "unknown" ? extractAtsIdentifierFromUrl(atsHost.type, final_url_after_redirects) : null;

  // HTML-based ATS detection (medium/low confidence).
  const htmlAtsType = fetched.html_detected_ats_type;
  const htmlAtsIdentifier = fetched.html_ats_identifier;
  const htmlAtsConfidence = fetched.html_detected_ats_confidence;

  const multiDomains =
    (fetched.redirect_hops || []).some(
      (h) => h.to_registrable_domain && h.to_registrable_domain !== h.from_registrable_domain,
    ) || input_registrable_domain !== final_registrable_domain;

  const manual_review_reason: SourceManualReviewReason[] = [];
  if (multiDomains) manual_review_reason.push("REDIRECT_CHAIN_CROSSES_DOMAINS");
  if (denyHtml) manual_review_reason.push("DENYLIST_HIT_IN_CHAIN");
  if (fetched.html_multi_ats_signals) manual_review_reason.push("MULTI_ATS_SIGNALS");

  // If the input host is a canonical ATS domain, trust that classification even if redirects go elsewhere.
  if (atsInputHost.type !== "unknown") {
    return {
      source_allowed: true,
      source_validation_result: "allowed",
      source_validation_confidence: "high",
      source_validation_reason: ["ATS_CANONICAL_DOMAIN"],
      normalized_careers_url: normalized.normalizedUrl,
      final_url_after_redirects,
      redirect_chain: fetched.redirect_chain,
      redirect_hops: fetched.redirect_hops,
      input_host,
      input_registrable_domain,
      final_host,
      final_registrable_domain,
      matched_employer_domain: null,
      matched_ats_domain: getRegistrableDomain(input_host),
      detected_third_party_domain: null,
      detected_ats_type: atsInputHost.type,
      ats_identifier: atsIdFromInputUrl,
      domain_match_type: "ats_canonical_match",
      denylist_match: false,
      denylist_match_domain: null,
      needs_manual_review: true,
      manual_review_reason: manual_review_reason.concat(atsIdFromInputUrl ? [] : ["CUSTOM_DOMAIN_TO_ATS"]),
      notes: ["ATS canonical host detected (input URL). Requires admin mapping to company."],
      fetch_status: fetched.fetch_status,
      content_type: fetched.content_type,
      page_title: fetched.page_title,
      evidence_clues: ["host:ats_canonical_input"].concat(fetched.html_clues),
      denylist_indicators_in_html: fetched.deny_indicators_in_html,
    };
  }

  if (atsHost.type !== "unknown") {
    return {
      source_allowed: true,
      source_validation_result: "allowed",
      source_validation_confidence: "high",
      source_validation_reason: ["ATS_CANONICAL_DOMAIN"],
      normalized_careers_url: normalized.normalizedUrl,
      final_url_after_redirects,
      redirect_chain: fetched.redirect_chain,
      redirect_hops: fetched.redirect_hops,
      input_host,
      input_registrable_domain,
      final_host,
      final_registrable_domain,
      matched_employer_domain: null,
      matched_ats_domain: getRegistrableDomain(final_host),
      detected_third_party_domain: null,
      detected_ats_type: atsHost.type,
      ats_identifier: atsIdFromUrl,
      domain_match_type: "ats_canonical_match",
      denylist_match: false,
      denylist_match_domain: null,
      needs_manual_review: true,
      manual_review_reason: manual_review_reason.concat(atsIdFromUrl ? [] : ["CUSTOM_DOMAIN_TO_ATS"]),
      notes: ["ATS canonical host detected. Requires admin mapping to company."],
      fetch_status: fetched.fetch_status,
      content_type: fetched.content_type,
      page_title: fetched.page_title,
      evidence_clues: ["host:ats_canonical"].concat(fetched.html_clues),
      denylist_indicators_in_html: fetched.deny_indicators_in_html,
    };
  }

  if (htmlAtsType !== "unknown") {
    // Embedded ATS on a company domain or custom hub. Always requires manual review.
    return {
      source_allowed: true,
      source_validation_result: "allowed_needs_review",
      source_validation_confidence: htmlAtsConfidence,
      source_validation_reason: ["ATS_EMBEDDED_SIGNAL"],
      normalized_careers_url: normalized.normalizedUrl,
      final_url_after_redirects,
      redirect_chain: fetched.redirect_chain,
      redirect_hops: fetched.redirect_hops,
      input_host,
      input_registrable_domain,
      final_host,
      final_registrable_domain,
      matched_employer_domain: null,
      matched_ats_domain: null,
      detected_third_party_domain: null,
      detected_ats_type: htmlAtsType,
      ats_identifier: htmlAtsIdentifier,
      domain_match_type: "unknown",
      denylist_match: false,
      denylist_match_domain: null,
      needs_manual_review: true,
      manual_review_reason: manual_review_reason.concat(htmlAtsIdentifier ? [] : ["CUSTOM_DOMAIN_TO_ATS"]),
      notes: ["ATS signals found in HTML. Manual review required to confirm official source and pick canonical endpoint."],
      fetch_status: fetched.fetch_status,
      content_type: fetched.content_type,
      page_title: fetched.page_title,
      evidence_clues: fetched.html_clues,
      denylist_indicators_in_html: fetched.deny_indicators_in_html,
    };
  }

  const matchedEmployerDomain = normalizedEmployerDomains.find((d) => d === final_registrable_domain) || null;
  if (matchedEmployerDomain) {
    return {
      source_allowed: true,
      source_validation_result: "allowed_needs_review",
      source_validation_confidence: "medium",
      source_validation_reason: ["EMPLOYER_DOMAIN_MATCH"],
      normalized_careers_url: normalized.normalizedUrl,
      final_url_after_redirects,
      redirect_chain: fetched.redirect_chain,
      redirect_hops: fetched.redirect_hops,
      input_host,
      input_registrable_domain,
      final_host,
      final_registrable_domain,
      matched_employer_domain: matchedEmployerDomain,
      matched_ats_domain: null,
      detected_third_party_domain: null,
      detected_ats_type: null,
      ats_identifier: null,
      domain_match_type: "employer_domain_match",
      denylist_match: false,
      denylist_match_domain: null,
      needs_manual_review: true,
      manual_review_reason,
      notes: ["Employer domain match. Requires admin confirmation and parseability check."],
      fetch_status: fetched.fetch_status,
      content_type: fetched.content_type,
      page_title: fetched.page_title,
      evidence_clues: fetched.html_clues,
      denylist_indicators_in_html: fetched.deny_indicators_in_html,
    };
  }

  return {
    source_allowed: true,
    source_validation_result: "allowed_needs_review",
    source_validation_confidence: "unknown",
    source_validation_reason: ["DOMAIN_OWNERSHIP_UNKNOWN"],
    normalized_careers_url: normalized.normalizedUrl,
    final_url_after_redirects,
    redirect_chain: fetched.redirect_chain,
    redirect_hops: fetched.redirect_hops,
    input_host,
    input_registrable_domain,
    final_host,
    final_registrable_domain,
    matched_employer_domain: null,
    matched_ats_domain: null,
    detected_third_party_domain: null,
    detected_ats_type: null,
    ats_identifier: null,
    domain_match_type: "unknown",
    denylist_match: false,
    denylist_match_domain: null,
    needs_manual_review: true,
    manual_review_reason: manual_review_reason.concat(["EMPLOYER_DOMAIN_UNKNOWN"]),
    notes: ["Unclear domain ownership. Manual review required."],
    fetch_status: fetched.fetch_status,
    content_type: fetched.content_type,
    page_title: fetched.page_title,
    evidence_clues: fetched.html_clues,
    denylist_indicators_in_html: fetched.deny_indicators_in_html,
  };
}

