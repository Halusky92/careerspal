# Sourcing release preflight

Branch `release/sourcing-pipeline-2026-11-10`, commit after `c6990b3`, based on `main` `1bbc50a`.
This file does not approve a push, merge, production SQL, or deploy.

## What the release contains

Short pipeline slices, resume after a timeout, salary lookup before evaluation and publish, Pipeline panel stats, ATS close protection, and `vercel.json` with only `/api/cron/stale-jobs` at 07:30 UTC. The GitHub workflow is `workflow_dispatch` only.

Not in this release: Tavily Discovery, discovery SQL, Premium limits, Stripe subscriptions, and the `/jobs` search fix.

## Migrations, not yet applied to production

`20261109120000_sourcing_freshness.sql` adds `last_seen_at` and `content_hash`. Re-running it does not overwrite a `last_seen_at` that is already set. It does not change `jobs.origin`, status, salary, company name, website, or logo.

`20261109120100_sourcing_close_from_board.sql` adds `missing_board_streak` (default 0) and `missing_board_streak_at`. Re-running it does not reset an existing streak. It does not delete jobs.

Production does not have `jobs.origin`. The earlier draft rewrote that column for Ashby and Lever rows. That statement is not in these files. Publish, freshness, and close-from-board keep working without it. An auto-published unpaid ATS job can still be updated or closed. A paid listing, a Start pack listing (`plan_price` 0), a founding listing, an explicit non-ATS origin, or a duplicate link to an existing job cannot. Employer screens still treat only `greenhouse` as sourced. Adding the column and switching those screens belongs in a later change, not this release.

Staging already has the columns. Its migration history records versions `20261109120000` and `20261109120100`. Production history does not, and must not until this SQL is approved.

The current production code ignores the new columns, so it can keep running after the migration and before the new deploy. The new code can also run before the columns exist, then persist streaks once they are added. Apply the SQL first so the first manual run can store them.

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
