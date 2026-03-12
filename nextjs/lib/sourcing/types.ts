export type SourcingSourceType =
  | "greenhouse"
  | "lever"
  | "ashby"
  | "workable"
  | "direct_custom"
  | "unknown";

export type SourceValidationState = "allowed" | "allowed_needs_review" | "denied" | "hold";

export type DetectionConfidence = "high" | "medium" | "low" | "unknown";

export type DomainMatchType =
  | "employer_domain_match"
  | "ats_canonical_match"
  | "third_party_denylist_match"
  | "unknown";

export type SourceValidationResult = "allowed" | "allowed_needs_review" | "denied";

export type SourceManualReviewReason =
  | "EMPLOYER_DOMAIN_UNKNOWN"
  | "MULTI_ATS_SIGNALS"
  | "REDIRECT_CHAIN_CROSSES_DOMAINS"
  | "CUSTOM_DOMAIN_TO_ATS"
  | "NO_JOBS_FOUND"
  | "PARSING_BLOCKED"
  | "DENYLIST_HIT_IN_CHAIN";

export type SourceValidatorOutput = {
  source_allowed: boolean;
  source_validation_result: SourceValidationResult;
  source_validation_confidence: DetectionConfidence;
  source_validation_reason: string[];
  normalized_careers_url: string;
  final_url_after_redirects: string;
  redirect_chain: string[];
  redirect_hops?: Array<{
    from_url: string;
    to_url: string | null;
    status: number;
    from_host: string;
    to_host: string | null;
    from_registrable_domain: string;
    to_registrable_domain: string | null;
    denylist_match: boolean;
    denylist_match_domain: string | null;
  }>;
  input_host: string;
  input_registrable_domain: string;
  final_host: string;
  final_registrable_domain: string;
  matched_employer_domain: string | null;
  matched_ats_domain: string | null;
  detected_third_party_domain: string | null;
  detected_ats_type: Exclude<SourcingSourceType, "direct_custom" | "unknown"> | null;
  ats_identifier: string | null;
  domain_match_type: DomainMatchType;
  denylist_match: boolean;
  denylist_match_domain: string | null;
  needs_manual_review: boolean;
  manual_review_reason: SourceManualReviewReason[];
  notes: string[];

  // Evidence snapshot (Validator v2)
  fetch_status?: number | null;
  content_type?: string | null;
  page_title?: string | null;
  evidence_clues?: string[];
  denylist_indicators_in_html?: string[];
};

