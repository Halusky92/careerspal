export type AutomationRunRecord = {
  id: string;
  actor_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function num(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

/** Panel row. Missing fields stay null so an older run is not shown as zero. */
export function automationRunView(row: AutomationRunRecord) {
  const metadata = (row.metadata || {}) as Record<string, any>;
  const publish = (metadata.auto_publish || {}) as Record<string, any>;
  const publishedJobIds = Array.isArray(publish.published_job_ids) ? publish.published_job_ids.filter(Boolean) : [];
  const duplicateJobIds = Array.isArray(publish.duplicate_job_ids) ? publish.duplicate_job_ids.filter(Boolean) : [];
  return {
    id: row.id,
    createdAt: row.created_at,
    actorId: row.actor_id,
    trigger: String(metadata.trigger || (row.actor_id ? "manual" : "cron")),
    timedOut: Boolean(metadata.timed_out),
    sourcesProcessed: num(metadata.sources_processed),
    ingestion: {
      rawFetched: num(metadata.raw_fetched),
      rawInserted: num(metadata.raw_inserted),
      rawSkipped: num(metadata.raw_skipped),
      runsCreated: num(metadata.runs_created),
    },
    normalization: {
      processed: num(metadata.normalization?.processed),
      inserted: num(metadata.normalization?.inserted),
      updated: num(metadata.normalization?.updated),
      skipped: num(metadata.normalization?.skipped),
      errors: num(metadata.normalization?.errors),
    },
    evaluation: {
      processed: num(metadata.evaluation?.processed),
      evaluated: num(metadata.evaluation?.evaluated),
      errors: num(metadata.evaluation?.errors),
    },
    autoPublish: {
      minScore: typeof publish.minScore === "number" ? publish.minScore : null,
      processed: num(publish.processed),
      published: num(publish.published),
      failed: num(publish.failed),
      skippedTotal: num(publish.skipped_total),
      skippedDuplicates: num(publish.skipped_duplicates),
      skippedNotEligible: num(publish.skipped_not_eligible),
      publishedJobIds,
      duplicateJobIds,
      reasons: publish.reasons && typeof publish.reasons === "object" ? publish.reasons : null,
    },
    salary: metadata.salary_enrichment
      ? {
          updated: num(metadata.salary_enrichment.updated),
          notFound: num(metadata.salary_enrichment.not_found),
          failed: num(metadata.salary_enrichment.failed),
        }
      : null,
    freshnessUpdated: metadata.freshness ? num(metadata.freshness.updated) : null,
    closed: metadata.close_from_board ? num(metadata.close_from_board.closed) : null,
    failedStep: metadata.failed_step ? String(metadata.failed_step) : null,
  };
}
