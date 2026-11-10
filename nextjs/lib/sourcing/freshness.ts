export const SOURCED_SEEN_GRACE_DAYS = 7;

export type SourcedFreshness = "active" | "unverified" | "removed";

export function classifySourcedFreshness(args: {
  lastSeenAt?: string | null;
  confirmedRemoved?: boolean;
  now?: number;
  graceDays?: number;
}): SourcedFreshness {
  if (args.confirmedRemoved) return "removed";
  const seen = args.lastSeenAt ? Date.parse(args.lastSeenAt) : NaN;
  if (!Number.isFinite(seen)) return "unverified";
  const now = args.now ?? Date.now();
  const graceMs = (args.graceDays ?? SOURCED_SEEN_GRACE_DAYS) * 24 * 60 * 60 * 1000;
  if (now - seen <= graceMs) return "active";
  return "unverified";
}

export function shouldExpireSourcedByAge(args: {
  lastSeenAt?: string | null;
  confirmedRemoved?: boolean;
  now?: number;
}) {
  // Age of the original posting is never enough. Only a confirmed ATS/apply removal may close it.
  return classifySourcedFreshness(args) === "removed";
}

export type RawHashDecision = "insert" | "update" | "unchanged";

export function rawHashDecision(existingHash?: string | null, nextHash?: string | null): RawHashDecision {
  if (!existingHash) return "insert";
  if (nextHash && existingHash === nextHash) return "unchanged";
  return "update";
}
