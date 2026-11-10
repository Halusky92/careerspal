# Sourcing release preflight

Branch `release/sourcing-pipeline-2026-11-10`, commit after `c6990b3`, based on `main` `1bbc50a`.
This file does not approve a push, merge, production SQL, or deploy.

## What the release contains

Short pipeline slices, resume after a timeout, salary lookup before evaluation and publish, Pipeline panel stats, ATS close protection, and `vercel.json` with only `/api/cron/stale-jobs` at 07:30 UTC. The GitHub workflow is `workflow_dispatch` only.

Not in this release: Tavily Discovery, discovery SQL, Premium limits, Stripe subscriptions, and the `/jobs` search fix.

## Migrations, not yet applied

`20261109_sourcing_freshness.sql` adds `last_seen_at` and `content_hash`. Re-running it does not overwrite a `last_seen_at` that is already set. It changes `jobs.origin` only from empty or `greenhouse` to `ashby` or `lever`, and only when that published job is already linked to an Ashby or Lever candidate. It does not change status, salary, company name, website, or logo.

`20261109_sourcing_close_from_board.sql` adds `missing_board_streak` (default 0) and `missing_board_streak_at`. Re-running it does not reset an existing streak. It does not delete jobs.

The current production code ignores the new columns, so it can keep running after the migration and before the new deploy. The new code needs the columns, so the migration comes first.

Check before, do not run until approved:

```sql
select j.id, j.origin, c.source_type
from public.jobs j
join public.sourcing_sourced_job_candidates c on c.published_job_id = j.id
where c.source_type in ('ashby', 'lever')
  and coalesce(j.origin, 'greenhouse') = 'greenhouse';
```

Check after: that query returns no rows. Company count and published job count stay the same.

## Unavailable ATS

A timeout, 429, or 5xx marks the run failed, leaves the source enabled, and closes nothing. A board 404 disables that one source and also closes nothing. Two healthy misses, 12 hours apart, are still required before an ATS job is closed. Age and one dead Apply URL do not close it.

## Manual runs, after an approved deploy

1. Confirm Vercel has only `stale-jobs` and the workflow file on `main` has no `cron:`.
2. Actions, Greenhouse daily pipeline, Run workflow, mode `refresh`. Stop if a slice is not `done` or the panel has a failed step.
3. Run workflow again with mode `salary`.
4. Read the panel: one reason per skipped job, salary filled or not found, and the published job ids.

## Rollback

1. Disable the GitHub workflow in Actions. Do not turn the four Greenhouse crons back on while the workflow can still run.
2. Promote the previous Vercel production deployment.
3. Leave the new columns in place. Dropping them is not required for the old code.
4. If a run published the wrong jobs, set those source rows `enabled = false` and unpublish only the job ids stored on that run. Do not disable every source. Paid employer listings stay.

## Still needs personal approval

Production SQL, push, merge, the first deploy, the manual refresh, the manual salary run, and only then a later commit that adds the 06:15 and 16:15 UTC schedule.
