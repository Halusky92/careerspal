-- CareersPal sourcing freshness (Phase 0)
-- Local / staging only until explicitly approved for production.
-- Does not rewrite employer paid listings. Origin backfill only maps
-- ATS-published jobs that were incorrectly stamped greenhouse.

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

update public.jobs as j
set origin = c.source_type
from public.sourcing_sourced_job_candidates as c
where c.published_job_id = j.id
  and c.source_type in ('ashby', 'lever')
  and coalesce(j.origin, 'greenhouse') = 'greenhouse';
