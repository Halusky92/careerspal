-- Employer dashboard: extra statuses, origin, company claim.
alter table public.jobs drop constraint if exists jobs_status_check;
alter table public.jobs add constraint jobs_status_check
  check (status in ('draft', 'published', 'paused', 'private', 'invite_only', 'pending_review', 'closed', 'archived'));

alter table public.jobs add column if not exists origin text not null default 'employer';

update public.jobs
set origin = 'greenhouse'
where id in (
  select published_job_id
  from public.sourcing_sourced_job_candidates
  where published_job_id is not null
);

alter table public.companies add column if not exists claimed_by uuid references public.profiles(id) on delete set null;
alter table public.companies add column if not exists founding_expires_at timestamptz;
