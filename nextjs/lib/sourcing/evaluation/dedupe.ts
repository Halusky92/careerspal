export type DedupeConfidence = "none" | "possible" | "high";

export type DedupeSignals = {
  apply_url_match?: boolean;
  job_url_match?: boolean;
  title_company_match?: boolean;
  matched_candidate_id?: string | null;
  matched_job_id?: string | null;
};

export type CandidateForDedupe = {
  id: string;
  title: string | null;
  company_name: string | null;
  apply_url: string | null;
  job_url: string | null;
};

const norm = (v: string | null | undefined) =>
  (v || "")
    .toLowerCase()
    .replace(/https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[\s\W_]+/g, " ")
    .trim();

export function computeTitleCompanyKey(c: { title: string | null; company_name: string | null }): string {
  const t = norm(c.title);
  const co = norm(c.company_name);
  return `${co}::${t}`.trim();
}

export function dedupeAgainst(
  candidate: CandidateForDedupe,
  others: CandidateForDedupe[],
  jobsByApplyUrl: Map<string, string>,
): { confidence: DedupeConfidence; duplicateOfCandidateId: string | null; duplicateOfJobId: string | null; signals: DedupeSignals } {
  const apply = norm(candidate.apply_url);
  const jobUrl = norm(candidate.job_url);
  const key = computeTitleCompanyKey(candidate);

  // High: matches an existing published job (by apply_url or job_url if stored as apply_url).
  if (apply && jobsByApplyUrl.has(apply)) {
    return {
      confidence: "high",
      duplicateOfCandidateId: null,
      duplicateOfJobId: jobsByApplyUrl.get(apply) || null,
      signals: { apply_url_match: true, matched_job_id: jobsByApplyUrl.get(apply) || null },
    };
  }
  if (jobUrl && jobsByApplyUrl.has(jobUrl)) {
    return {
      confidence: "high",
      duplicateOfCandidateId: null,
      duplicateOfJobId: jobsByApplyUrl.get(jobUrl) || null,
      signals: { job_url_match: true, matched_job_id: jobsByApplyUrl.get(jobUrl) || null },
    };
  }

  // High: matches another candidate by apply_url or job_url.
  if (apply) {
    const other = others.find((o) => o.id !== candidate.id && norm(o.apply_url) === apply);
    if (other) {
      return {
        confidence: "high",
        duplicateOfCandidateId: other.id,
        duplicateOfJobId: null,
        signals: { apply_url_match: true, matched_candidate_id: other.id },
      };
    }
  }
  if (jobUrl) {
    const other = others.find((o) => o.id !== candidate.id && norm(o.job_url) === jobUrl);
    if (other) {
      return {
        confidence: "high",
        duplicateOfCandidateId: other.id,
        duplicateOfJobId: null,
        signals: { job_url_match: true, matched_candidate_id: other.id },
      };
    }
  }

  // Possible: same company+title key (conservative).
  if (key && key !== "::") {
    const other = others.find((o) => o.id !== candidate.id && computeTitleCompanyKey(o) === key);
    if (other) {
      return {
        confidence: "possible",
        duplicateOfCandidateId: other.id,
        duplicateOfJobId: null,
        signals: { title_company_match: true, matched_candidate_id: other.id },
      };
    }
  }

  return { confidence: "none", duplicateOfCandidateId: null, duplicateOfJobId: null, signals: {} };
}

