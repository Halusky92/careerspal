export const SOURCING_OVERVIEW_CAP = 620;

export type OverviewSource = {
  sourceType: string;
  identifier: string | null;
  enabled: boolean;
  validationState: string;
  createdAt: string;
  companyId: string | null;
  companyCreatedAt: string | null;
  approvedAt?: string | null;
  approvalNotes?: string | null;
};

export type OverviewBoard = { provider: string; identifier: string };

export type OverviewRun = {
  createdAt: string;
  trigger: string | null;
  failedStep: string | null;
  timedOut: boolean;
  published: number | null;
  closed: number | null;
};

export type OverviewWindow = {
  sources: number;
  companies: number;
  published: number | null;
  closed: number | null;
};

function sourceKey(type: string | null | undefined, identifier: string | null | undefined) {
  const id = (identifier || "").trim().toLowerCase();
  const name = (type || "").trim().toLowerCase();
  if (!name || !id) return "";
  return `${name}:${id}`;
}

function since(now: Date, days: number) {
  if (days === 0) return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function inWindow(iso: string | null | undefined, start: Date) {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  return Number.isFinite(time) && time >= start.getTime();
}

function sumKnown(values: Array<number | null>) {
  if (values.length === 0) return 0;
  const known = values.filter((value): value is number => typeof value === "number");
  if (known.length === 0) return null;
  return known.reduce((sum, value) => sum + value, 0);
}

function windowFor(start: Date, sources: OverviewSource[], runs: OverviewRun[], discovery: Set<string>): OverviewWindow {
  const saved = sources.filter((source) => discovery.has(sourceKey(source.sourceType, source.identifier)));
  const companies = new Set(
    saved.filter((source) => source.companyId && inWindow(source.companyCreatedAt, start)).map((source) => source.companyId),
  );
  const periodRuns = runs.filter((run) => inWindow(run.createdAt, start));
  return {
    sources: saved.filter((source) => inWindow(source.createdAt, start)).length,
    companies: companies.size,
    published: sumKnown(periodRuns.map((run) => run.published)),
    closed: sumKnown(periodRuns.map((run) => run.closed)),
  };
}

/** Shapes admin counts. Missing history stays null instead of a guessed zero. */
export function buildSourcingOverview(args: {
  now: Date;
  boards: OverviewBoard[] | null;
  sources: OverviewSource[] | null;
  runs: OverviewRun[] | null;
  publishedJobs: number | null;
  tavilySearches: number | null;
}) {
  const discovery =
    args.boards === null
      ? null
      : new Set(args.boards.map((board) => sourceKey(board.provider, board.identifier)).filter(Boolean));
  const sources = args.sources || [];
  const runs = args.runs || [];
  const pending =
    discovery === null || args.sources === null
      ? null
      : sources.filter((source) => {
          const key = sourceKey(source.sourceType, source.identifier);
          return Boolean(key && discovery.has(key) && (!source.enabled || source.validationState !== "allowed"));
        }).length;
  return {
    windows:
      discovery === null || args.sources === null || args.runs === null
        ? null
        : {
            today: windowFor(since(args.now, 0), sources, runs, discovery),
            days7: windowFor(since(args.now, 7), sources, runs, discovery),
            days30: windowFor(since(args.now, 30), sources, runs, discovery),
          },
    discoveredBoards: args.boards?.length ?? null,
    pendingReview: pending,
    autoApproved: args.sources === null ? null : sources.filter((source) => (source.approvalNotes || "").startsWith("auto:")).length,
    approvals: sources
      .filter((source) => (source.approvalNotes || "").startsWith("auto:") && source.approvedAt)
      .map((source) => ({
        at: source.approvedAt || "",
        identifier: source.identifier,
        title: (source.approvalNotes || "").slice("auto:".length).trim(),
      }))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 8),
    publishedJobs: args.publishedJobs,
    tavily: { used: args.tavilySearches, cap: SOURCING_OVERVIEW_CAP },
    runs: (args.runs || []).slice(0, 5).map((run) => ({
      createdAt: run.createdAt,
      trigger: run.trigger,
      error: run.failedStep || (run.timedOut ? "timed_out" : null),
    })),
  };
}
