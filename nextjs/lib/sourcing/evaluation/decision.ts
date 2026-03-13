import { REASON_SEVERITY, type ReasonCode } from "./reasonCodes";
import { getSourcingAutoPublishMinScore } from "../config";

export type Decision = "auto_publish_candidate" | "manual_review_candidate" | "reject_candidate";

export function prepareDecision(args: {
  score_total: number;
  reasons: ReasonCode[];
  salary_present: boolean;
  duplicate_confidence: "none" | "possible" | "high";
}): {
  decision: Decision;
  blocking: ReasonCode[];
  warnings: ReasonCode[];
  info: ReasonCode[];
} {
  const reasons = Array.from(new Set(args.reasons));

  // Inject dedupe reasons
  if (args.duplicate_confidence === "high") reasons.push("DUPLICATE_HIGH");
  if (args.duplicate_confidence === "possible") reasons.push("DUPLICATE_POSSIBLE");

  const blocking: ReasonCode[] = [];
  const warnings: ReasonCode[] = [];
  const info: ReasonCode[] = [];

  for (const r of reasons) {
    const sev = REASON_SEVERITY[r];
    if (sev === "BLOCK") blocking.push(r);
    else if (sev === "WARN") warnings.push(r);
    else info.push(r);
  }

  // Salary-first: salary missing blocks auto-publish, but doesn't auto-reject.
  // Keep as warning.
  const minScore = getSourcingAutoPublishMinScore();
  const autoPublishEligible =
    args.salary_present &&
    args.score_total >= minScore &&
    blocking.length === 0 &&
    warnings.filter((w) => w !== "SALARY_MISSING").length === 0;

  if (blocking.length > 0) {
    return { decision: "reject_candidate", blocking, warnings, info: info.concat(["NEEDS_REVIEW"]) };
  }
  if (autoPublishEligible) {
    return { decision: "auto_publish_candidate", blocking, warnings, info: info.concat(["AUTO_PUBLISH_QUALITY"]) };
  }
  return { decision: "manual_review_candidate", blocking, warnings, info: info.concat(["NEEDS_REVIEW"]) };
}

