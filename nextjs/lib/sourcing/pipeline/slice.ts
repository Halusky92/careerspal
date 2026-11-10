export const SLICE_BUDGET_MS = 45_000;
export const FULL_BUDGET_MS = 240_000;
export const SALARY_DAILY_CAP = 8;
export const SALARY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export type SliceMode = "refresh" | "salary" | "full";

export function parseSliceMode(value: string | null | undefined): SliceMode {
  if (value === "salary") return "salary";
  if (value === "full") return "full";
  return "refresh";
}

export function sliceBudgetMs(mode: SliceMode) {
  return mode === "full" ? FULL_BUDGET_MS : SLICE_BUDGET_MS;
}

export function sliceExpired(deadline: number | null | undefined, now = Date.now()) {
  return typeof deadline === "number" && now >= deadline;
}

export type SourceAttempt = {
  id: string;
  startedAt: string | null;
  status: string | null;
};

/** A board is due until today's fetch finished, or until a partial slice is resumed. */
export function sourcesDueForRefresh(sources: SourceAttempt[], now: Date, limit: number): string[] {
  const day = new Date(now);
  day.setUTCHours(0, 0, 0, 0);
  const dayIso = day.toISOString();
  const pending = sources.filter((source) => {
    if (!source.startedAt || source.startedAt < dayIso) return true;
    return source.status === "partial";
  });
  pending.sort((a, b) => (a.startedAt || "").localeCompare(b.startedAt || ""));
  return pending.slice(0, Math.max(0, limit)).map((source) => source.id);
}

export function salaryAttemptIso(provenance: unknown): string | null {
  if (!provenance || typeof provenance !== "object") return null;
  const record = provenance as {
    salary_enrichment_attempt?: { attempted_at?: unknown };
    salary_enrichment?: { fetched_at?: unknown; fetchedAt?: unknown };
  };
  const ts =
    record.salary_enrichment_attempt?.attempted_at ||
    record.salary_enrichment?.fetched_at ||
    record.salary_enrichment?.fetchedAt ||
    null;
  return typeof ts === "string" && ts ? ts : null;
}

export function salaryLookupDue(provenance: unknown, nowMs: number, cooldownMs = SALARY_COOLDOWN_MS) {
  const iso = salaryAttemptIso(provenance);
  if (!iso || cooldownMs <= 0) return true;
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return true;
  return nowMs - at >= cooldownMs;
}

export type SalaryCandidateRef = { sourceId: string; provenance: unknown };

/** One company per slice, at most SALARY_DAILY_CAP page lookups per company per UTC day. */
export function chooseSalarySource(
  rows: SalaryCandidateRef[],
  enabledIds: string[],
  nowMs: number,
  cooldownMs = SALARY_COOLDOWN_MS,
  dailyCap = SALARY_DAILY_CAP,
): string | null {
  const enabled = new Set(enabledIds);
  const day = new Date(nowMs);
  day.setUTCHours(0, 0, 0, 0);
  const dayIso = day.toISOString();
  const attemptsToday = new Map<string, number>();
  const due: string[] = [];
  for (const row of rows) {
    if (!enabled.has(row.sourceId)) continue;
    const iso = salaryAttemptIso(row.provenance);
    if (iso && iso >= dayIso) attemptsToday.set(row.sourceId, (attemptsToday.get(row.sourceId) || 0) + 1);
    if (!salaryLookupDue(row.provenance, nowMs, cooldownMs)) continue;
    if (!due.includes(row.sourceId)) due.push(row.sourceId);
  }
  return due.find((sourceId) => (attemptsToday.get(sourceId) || 0) < dailyCap) || null;
}

const SKIP_REASON_ORDER = [
  "salary_missing",
  "salary_range_missing",
  "off_niche_title",
  "onsite_only",
  "hybrid_not_remote",
  "outside_us",
  "geo_unconfirmed",
  "apply_missing",
  "description_thin",
  "apply_dead",
  "score_below_min",
  "decision",
];

/** One skipped job counts once, so the reason totals match the skipped total. */
export function countPublishOutcomes(results: Array<{ status?: string; reason?: string | string[] }>) {
  const reasons: Record<string, number> = {};
  for (const row of results) {
    if (row.status !== "skipped") continue;
    const list = (Array.isArray(row.reason) ? row.reason : row.reason ? [row.reason] : []).map(String);
    const key =
      SKIP_REASON_ORDER.find((name) => list.some((item) => item === name || item.startsWith(`${name}(`) || item.startsWith(`${name}:`))) ||
      list[0] ||
      "other";
    reasons[key] = (reasons[key] || 0) + 1;
  }
  return reasons;
}

export function shouldReopenUnpublishedCandidate(args: {
  publishedJobId: string | null;
  previousHash: string | null;
  nextHash: string | null;
}) {
  if (args.publishedJobId) return false;
  if (!args.previousHash || !args.nextHash) return false;
  return args.previousHash !== args.nextHash;
}
