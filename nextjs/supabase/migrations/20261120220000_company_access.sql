-- Additive company access. Do not run 20261102_employer_dashboard.sql.
-- This file does not merge companies or jobs. Apply only after a backup.
-- If jobs_apply_url_uidx fails, stop. That means two live rows share an Apply URL.

alter table public.jobs add column if not exists origin text;

update public.jobs
set origin = 'employer'
where origin is null
  and (
    (plan_price is not null and plan_price > 0)
    or stripe_payment_status in ('paid', 'founding')
    or (
      plan_price = 0
      and not exists (
        select 1
        from public.sourcing_sourced_job_candidates as candidate
        where candidate.published_job_id = jobs.id
          and candidate.publish_status = 'auto_published'
      )
    )
  );

update public.jobs as job
set origin = (
  select case candidate.source_type
    when 'ashby' then 'ashby'
    when 'lever' then 'lever'
    when 'greenhouse' then 'greenhouse'
    else 'sourced'
  end
  from public.sourcing_sourced_job_candidates as candidate
  where candidate.published_job_id = job.id
    and candidate.publish_status = 'auto_published'
  order by candidate.source_type
  limit 1
)
where job.origin is null
  and coalesce(job.plan_price, 0) = 0
  and coalesce(job.stripe_payment_status, '') not in ('paid', 'founding')
  and exists (
    select 1
    from public.sourcing_sourced_job_candidates as candidate
    where candidate.published_job_id = job.id
      and candidate.publish_status = 'auto_published'
  );

alter table public.jobs drop constraint if exists jobs_origin_check;
alter table public.jobs
  add constraint jobs_origin_check
  check (origin is null or origin in ('employer', 'greenhouse', 'ashby', 'lever', 'sourced'));

create unique index if not exists jobs_apply_url_uidx
  on public.jobs (apply_url)
  where apply_url is not null and apply_url <> '' and apply_url <> '#';

create table if not exists public.company_memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('admin', 'poster')),
  status text not null default 'active' check (status in ('active', 'revoked')),
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (company_id, profile_id)
);

create table if not exists public.company_access_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  email_domain text not null,
  email_verified boolean not null default false,
  match_kind text,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'approved', 'rejected', 'revoked')),
  evidence text,
  decision_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists company_access_requests_status_idx
  on public.company_access_requests (status, created_at desc);

create table if not exists public.company_aliases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  kind text not null check (kind in ('name', 'domain', 'ats')),
  value text not null,
  status text not null default 'verified' check (status in ('verified', 'pending')),
  created_at timestamptz not null default now(),
  unique (kind, value)
);

alter table public.company_memberships enable row level security;
alter table public.company_access_requests enable row level security;
alter table public.company_aliases enable row level security;

alter table public.company_memberships force row level security;
alter table public.company_access_requests force row level security;
alter table public.company_aliases force row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on table public.company_memberships from anon';
    execute 'revoke all on table public.company_access_requests from anon';
    execute 'revoke all on table public.company_aliases from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on table public.company_memberships from authenticated';
    execute 'revoke all on table public.company_access_requests from authenticated';
    execute 'revoke all on table public.company_aliases from authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, update, delete on table public.company_memberships to service_role';
    execute 'grant select, insert, update, delete on table public.company_access_requests to service_role';
    execute 'grant select, insert, update, delete on table public.company_aliases to service_role';
  end if;
end $$;
