-- Supabase schema for CareersPal job board

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.slugify(value text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_employer()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'employer'
  );
$$;

create or replace function public.is_candidate()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'candidate'
  );
$$;

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null default 'candidate' check (role in ('candidate', 'employer', 'admin')),
  full_name text,
  avatar_url text,
  is_onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "profiles_select_own"
on public.profiles for select
using (id = auth.uid() or public.is_admin());

create policy "profiles_insert_own"
on public.profiles for insert
with check (id = auth.uid());

create policy "profiles_update_own"
on public.profiles for update
using (id = auth.uid() or public.is_admin());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email, role, is_onboarded)
  values (new.id, new.email, 'candidate', false)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Companies
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  website text,
  description text,
  long_description text,
  logo_url text,
  location text,
  employee_count text,
  verified boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists companies_name_unique on public.companies (name);

create trigger companies_set_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

create or replace function public.set_company_slug()
returns trigger
language plpgsql
as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug = public.slugify(new.name);
  end if;
  return new;
end;
$$;

drop trigger if exists companies_set_slug on public.companies;
create trigger companies_set_slug
before insert or update on public.companies
for each row execute function public.set_company_slug();

alter table public.companies enable row level security;

create policy "companies_select_all"
on public.companies for select
using (true);

create policy "companies_insert_employer"
on public.companies for insert
with check (public.is_employer() or public.is_admin());

create policy "companies_update_owner"
on public.companies for update
using (created_by = auth.uid() or public.is_admin());

create policy "companies_delete_owner"
on public.companies for delete
using (created_by = auth.uid() or public.is_admin());

-- Jobs
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  title text not null,
  slug text unique,
  description text not null,
  location text,
  remote_policy text,
  type text check (type in ('Full-time', 'Part-time', 'Contract')),
  salary text,
  salary_min int,
  salary_max int,
  salary_currency text default 'USD',
  posted_at_text text,
  timestamp bigint,
  category text,
  apply_url text,
  company_description text,
  company_website text,
  logo_url text,
  tags jsonb,
  tools jsonb,
  benefits jsonb,
  keywords text,
  match_score int,
  is_featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published', 'paused', 'private', 'invite_only', 'pending_review')),
  plan_type text check (plan_type in ('Standard', 'Featured Pro', 'Elite Managed')),
  plan_price int,
  plan_currency text default 'USD',
  views int not null default 0,
  matches int not null default 0,
  stripe_session_id text,
  stripe_payment_status text,
  created_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_company_id_idx on public.jobs (company_id);
create index if not exists jobs_status_idx on public.jobs (status);
create index if not exists jobs_created_by_idx on public.jobs (created_by);
create index if not exists jobs_published_at_idx on public.jobs (published_at);
create index if not exists jobs_category_idx on public.jobs (category);
create index if not exists jobs_plan_type_idx on public.jobs (plan_type);
create index if not exists jobs_type_idx on public.jobs (type);
create index if not exists jobs_location_idx on public.jobs (location);

create trigger jobs_set_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

create or replace function public.set_job_slug()
returns trigger
language plpgsql
as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug = public.slugify(new.title) || '-' || substring(new.id::text from 1 for 8);
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_set_slug on public.jobs;
create trigger jobs_set_slug
before insert or update on public.jobs
for each row execute function public.set_job_slug();

alter table public.jobs enable row level security;

create policy "jobs_select_published"
on public.jobs for select
using (status = 'published' or created_by = auth.uid() or public.is_admin());

create policy "jobs_insert_employer"
on public.jobs for insert
with check (public.is_employer() or public.is_admin());

create policy "jobs_update_owner"
on public.jobs for update
using (created_by = auth.uid() or public.is_admin());

create policy "jobs_delete_owner"
on public.jobs for delete
using (created_by = auth.uid() or public.is_admin());

-- Tags
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text unique
);

alter table public.tags enable row level security;

create policy "tags_select_all"
on public.tags for select
using (true);

create policy "tags_insert_admin"
on public.tags for insert
with check (public.is_admin());

-- Job tags
create table if not exists public.job_tags (
  job_id uuid references public.jobs(id) on delete cascade,
  tag_id uuid references public.tags(id) on delete cascade,
  primary key (job_id, tag_id)
);

alter table public.job_tags enable row level security;

create policy "job_tags_select_all"
on public.job_tags for select
using (true);

create policy "job_tags_write_owner"
on public.job_tags for insert
with check (
  exists (
    select 1 from public.jobs j
    where j.id = job_id and (j.created_by = auth.uid() or public.is_admin())
  )
);

create policy "job_tags_delete_owner"
on public.job_tags for delete
using (
  exists (
    select 1 from public.jobs j
    where j.id = job_id and (j.created_by = auth.uid() or public.is_admin())
  )
);

-- Saved jobs
create table if not exists public.saved_jobs (
  user_id uuid references public.profiles(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

alter table public.saved_jobs enable row level security;

create policy "saved_jobs_select_own"
on public.saved_jobs for select
using (user_id = auth.uid() or public.is_admin());

create policy "saved_jobs_insert_own"
on public.saved_jobs for insert
with check (user_id = auth.uid());

create policy "saved_jobs_delete_own"
on public.saved_jobs for delete
using (user_id = auth.uid() or public.is_admin());

-- Applications
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  status text not null default 'applied' check (status in ('applied', 'screening', 'interview', 'offer', 'hired', 'rejected', 'withdrawn')),
  cover_letter text,
  resume_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists applications_job_id_idx on public.applications (job_id);

create trigger applications_set_updated_at
before update on public.applications
for each row execute function public.set_updated_at();

alter table public.applications enable row level security;

create policy "applications_select_own_or_employer"
on public.applications for select
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.jobs j
    where j.id = job_id and (j.created_by = auth.uid() or public.is_admin())
  )
);

create policy "applications_insert_authenticated"
on public.applications for insert
with check (auth.uid() is not null);

create policy "applications_update_employer"
on public.applications for update
using (
  exists (
    select 1 from public.jobs j
    where j.id = job_id and (j.created_by = auth.uid() or public.is_admin())
  )
);

-- Alerts / saved searches
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  query text not null,
  location text,
  created_at timestamptz not null default now(),
  last_run_at timestamptz
);

create index if not exists alerts_user_id_idx on public.alerts (user_id);

alter table public.alerts enable row level security;

create policy "alerts_select_own"
on public.alerts for select
using (user_id = auth.uid() or public.is_admin());

create policy "alerts_insert_own"
on public.alerts for insert
with check (user_id = auth.uid());

create policy "alerts_delete_own"
on public.alerts for delete
using (user_id = auth.uid() or public.is_admin());

-- Files
create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  url text not null,
  mime_type text,
  size int,
  created_at timestamptz not null default now()
);

create index if not exists files_user_id_idx on public.files (user_id);

alter table public.files enable row level security;

create policy "files_select_own"
on public.files for select
using (user_id = auth.uid() or public.is_admin());

create policy "files_insert_own"
on public.files for insert
with check (user_id = auth.uid());

create policy "files_delete_own"
on public.files for delete
using (user_id = auth.uid() or public.is_admin());

-- Job views
create table if not exists public.job_views (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete cascade,
  viewer_id uuid references public.profiles(id) on delete set null,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists job_views_job_id_idx on public.job_views (job_id);

alter table public.job_views enable row level security;

create policy "job_views_insert_any"
on public.job_views for insert
with check (true);

create policy "job_views_select_employer"
on public.job_views for select
using (
  public.is_admin()
  or exists (
    select 1 from public.jobs j
    where j.id = job_id and j.created_by = auth.uid()
  )
);

-- Job matches
create table if not exists public.job_matches (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  score int,
  created_at timestamptz not null default now()
);

create index if not exists job_matches_job_id_idx on public.job_matches (job_id);

alter table public.job_matches enable row level security;

create policy "job_matches_insert_any"
on public.job_matches for insert
with check (true);

create policy "job_matches_select_employer"
on public.job_matches for select
using (
  public.is_admin()
  or exists (
    select 1 from public.jobs j
    where j.id = job_id and j.created_by = auth.uid()
  )
);

-- Audit logs
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  action text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_job_id_idx on public.audit_logs (job_id);

alter table public.audit_logs enable row level security;

create policy "audit_logs_select_admin"
on public.audit_logs for select
using (public.is_admin());

create policy "audit_logs_insert_any"
on public.audit_logs for insert
with check (auth.uid() is not null);

-- Payments
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  provider text not null,
  provider_id text,
  amount_cents int not null,
  currency text not null default 'USD',
  status text not null,
  created_at timestamptz not null default now()
);

create index if not exists payments_user_id_idx on public.payments (user_id);

alter table public.payments enable row level security;

create policy "payments_select_own"
on public.payments for select
using (user_id = auth.uid() or public.is_admin());

create policy "payments_insert_admin"
on public.payments for insert
with check (public.is_admin());
