-- CareersPal close-from-board streak.
-- Adds columns only. Does not close jobs or change employer accounts.
-- Idempotent. A missing streak stays 0, so nothing is closed by this migration.

alter table public.sourcing_sourced_job_candidates
  add column if not exists missing_board_streak int not null default 0;

alter table public.sourcing_sourced_job_candidates
  add column if not exists missing_board_streak_at timestamptz;
