-- CareersPal sourcing freshness.
-- Adds columns only. Does not change jobs.origin, listing status, or company accounts.
-- Idempotent. Staging already has these columns; production does not.
-- jobs.origin is intentionally untouched. Production has no origin column, and the
-- employer screens still treat only origin = greenhouse as a sourced listing.

alter table public.sourcing_sourced_jobs_raw
  add column if not exists last_seen_at timestamptz;

update public.sourcing_sourced_jobs_raw
set last_seen_at = coalesce(last_seen_at, fetched_at, now())
where last_seen_at is null;

alter table public.sourcing_sourced_job_candidates
  add column if not exists last_seen_at timestamptz;

update public.sourcing_sourced_job_candidates
set last_seen_at = coalesce(last_seen_at, updated_at, created_at, now())
where last_seen_at is null;

alter table public.jobs
  add column if not exists last_seen_at timestamptz;

alter table public.jobs
  add column if not exists content_hash text;
