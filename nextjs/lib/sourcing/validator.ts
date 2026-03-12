import { matchDenylistHost } from "./denylist";
import { getRegistrableDomain, normalizeHost, normalizeUrlForRegistry } from "./domain";
import type { DetectionConfidence, SourcingSourceType, SourceValidatorOutput } from "./types";

const ATS_CANONICAL = {
  greenhouse: new Set(["boards.greenhouse.io", "boards.eu.greenhouse.io"]),
  lever: new Set(["jobs.lever.co"]),
  ashby: new Set(["jobs.ashbyhq.com"]),
} as const;

type DetectedAts = "greenhouse" | "lever" | "ashby" | "workable" | "unknown";

function detectAtsFromHost(host: string): { type: DetectedAts; confidence: DetectionConfidence } {
  const h = normalizeHost(host);
  if (!h) return { type: "unknown", confidence: "unknown" };

  if (ATS_CANONICAL.greenhouse.has(h)) return { type: "greenhouse", confidence: "high" };
  if (ATS_CANONICAL.lever.has(h)) return { type: "lever", confidence: "high" };
  if (ATS_CANONICAL.ashby.has(h)) return { type: "ashby", confidence: "high" };

  if (h === "apply.workable.com" || h.endsWith(".workable.com")) {
    return { type: "workable", confidence: "high" };
  }

  return { type: "unknown", confidence: "unknown" };
}

function extractAtsIdentifier(type: Exclude<DetectedAts, "unknown">, normalizedUrl: string): string | null {
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

export function validateSourceUrl(inputUrl: string, employerRegistrableDomains: string[] = []): SourceValidatorOutput {
  const { normalizedUrl, host, registrableDomain } = normalizeUrlForRegistry(inputUrl);

  // MVP: no network redirect resolution here. Caller can supply real redirect chain later.
  const redirect_chain = [normalizedUrl];
  const final_url_after_redirects = normalizedUrl;
  const final_host = host;
  const final_registrable_domain = registrableDomain;

  const deny = matchDenylistHost(final_host);
  if (deny.matched) {
    return {
      source_allowed: false,
      source_validation_result: "denied",
      source_validation_confidence: "high",
      source_validation_reason: ["DENYLIST_MATCH"],
      normalized_careers_url: normalizedUrl,
      final_url_after_redirects,
      redirect_chain,
      input_host: host,
      input_registrable_domain: registrableDomain,
      final_host,
      final_registrable_domain,
      matched_employer_domain: null,
      matched_ats_domain: null,
      detected_third_party_domain: deny.matchDomain || getRegistrableDomain(final_host) || final_host,
      detected_ats_type: null,
      ats_identifier: null,
      domain_match_type: "third_party_denylist_match",
      denylist_match: true,
      denylist_match_domain: deny.matchDomain || null,
      needs_manual_review: false,
      manual_review_reason: ["DENYLIST_HIT_IN_CHAIN"],
      notes: ["Blocked: denylist match."],
    };
  }

  const ats = detectAtsFromHost(final_host);
  const atsIdentifier = ats.type !== "unknown" ? extractAtsIdentifier(ats.type, normalizedUrl) : null;

  if (ats.type !== "unknown") {
    return {
      source_allowed: true,
      source_validation_result: ats.confidence === "high" ? "allowed" : "allowed_needs_review",
      source_validation_confidence: ats.confidence,
      source_validation_reason: ["ATS_CANONICAL_DOMAIN"],
      normalized_careers_url: normalizedUrl,
      final_url_after_redirects,
      redirect_chain,
      input_host: host,
      input_registrable_domain: registrableDomain,
      final_host,
      final_registrable_domain,
      matched_employer_domain: null,
      matched_ats_domain: getRegistrableDomain(final_host),
      detected_third_party_domain: null,
      detected_ats_type: ats.type,
      ats_identifier: atsIdentifier,
      domain_match_type: "ats_canonical_match",
      denylist_match: false,
      denylist_match_domain: null,
      needs_manual_review: true,
      manual_review_reason: atsIdentifier ? [] : ["CUSTOM_DOMAIN_TO_ATS"],
      notes: ["ATS canonical host detected. Requires admin mapping to company."],
    };
  }

  const normalizedEmployerDomains = employerRegistrableDomains.map((d) => (d || "").trim().toLowerCase()).filter(Boolean);
  const matchedEmployerDomain = normalizedEmployerDomains.find((d) => d === final_registrable_domain) || null;

  if (matchedEmployerDomain) {
    return {
      source_allowed: true,
      source_validation_result: "allowed_needs_review",
      source_validation_confidence: "medium",
      source_validation_reason: ["EMPLOYER_DOMAIN_MATCH"],
      normalized_careers_url: normalizedUrl,
      final_url_after_redirects,
      redirect_chain,
      input_host: host,
      input_registrable_domain: registrableDomain,
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
      manual_review_reason: [],
      notes: ["Employer domain match. Requires admin confirmation and parseability check."],
    };
  }

  return {
    source_allowed: true,
    source_validation_result: "allowed_needs_review",
    source_validation_confidence: "unknown",
    source_validation_reason: ["DOMAIN_OWNERSHIP_UNKNOWN"],
    normalized_careers_url: normalizedUrl,
    final_url_after_redirects,
    redirect_chain,
    input_host: host,
    input_registrable_domain: registrableDomain,
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
    manual_review_reason: ["EMPLOYER_DOMAIN_UNKNOWN"],
    notes: ["Unclear domain ownership. Manual review required."],
  };
}

