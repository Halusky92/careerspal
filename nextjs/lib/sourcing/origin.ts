export const SOURCED_JOB_ORIGINS = ["greenhouse", "ashby", "lever", "sourced"] as const;
export type SourcedJobOrigin = (typeof SOURCED_JOB_ORIGINS)[number];

export function sourcedOriginFromSourceType(sourceType?: string | null): SourcedJobOrigin {
  const value = (sourceType || "").trim().toLowerCase();
  if (value === "ashby" || value === "lever" || value === "greenhouse") return value;
  return "sourced";
}

export function isSourcedJobOrigin(origin?: string | null) {
  const value = (origin || "").trim().toLowerCase();
  return (SOURCED_JOB_ORIGINS as readonly string[]).includes(value);
}

export function isEmployerManagedOrigin(origin?: string | null) {
  if (!origin) return true;
  return !isSourcedJobOrigin(origin);
}
