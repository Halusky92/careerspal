/**
 * Decides whether a direct /jobs/[slug] request is a public listing, a real
 * miss, or a lookup that failed before we could know. Database failures must
 * stay out of the miss path: the public job API maps those failures to 404.
 */

export type LookupError = { code?: string | null };

export class JobLookupUnavailableError extends Error {
  constructor() {
    super("Job lookup unavailable");
    this.name = "JobLookupUnavailableError";
  }
}

const MISSING_ROW_CODES = new Set(["PGRST116", "22P02"]);

export type DirectLookup<T> =
  | { outcome: "found"; job: T }
  | { outcome: "missing" }
  | { outcome: "retry"; reason: "not_configured" | "query_failed" };

export function interpretDirectLookup<T>(input: {
  jobId: string | null;
  configured: boolean;
  row: T | null;
  error: LookupError | null;
  isPublic: boolean;
}): DirectLookup<T> {
  if (!input.jobId) return { outcome: "missing" };
  if (!input.configured) return { outcome: "retry", reason: "not_configured" };
  if (input.row && !input.error) {
    return input.isPublic ? { outcome: "found", job: input.row } : { outcome: "missing" };
  }
  const code = input.error?.code || "";
  if (MISSING_ROW_CODES.has(code)) return { outcome: "missing" };
  return { outcome: "retry", reason: "query_failed" };
}

export type ApiFallback<T> =
  | { outcome: "found"; job: T }
  | { outcome: "missing" }
  | { outcome: "unavailable" };

export function interpretApiFallback<T>(input: {
  reason: "not_configured" | "query_failed";
  status: number | null;
  job: T | null;
  isPublic: boolean;
}): ApiFallback<T> {
  if (input.status === 200 && input.job && input.isPublic) {
    return { outcome: "found", job: input.job };
  }
  // The public API answers 404 both for a hidden row and for a failed query.
  // After our own query failed, that 404 is not evidence the role is gone.
  if (input.reason === "query_failed") return { outcome: "unavailable" };
  if (input.status === 404) return { outcome: "missing" };
  return { outcome: "unavailable" };
}
