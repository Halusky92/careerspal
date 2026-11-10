-- CareersPal close-from-board streak (Phase 1)
-- Local / staging only until explicitly approved for production.
-- Additive. Does not delete jobs or change employer paid listings.

alter table public.sourcing_sourced_job_candidates
  add column if not exists missing_board_streak int not null default 0;

alter table public.sourcing_sourced_job_candidates
  add column if not exists missing_board_streak_at timestamptz;
