alter table public.profiles add column if not exists headline text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists hobbies text;
alter table public.profiles add column if not exists profile_visibility text not null default 'private';
alter table public.profiles add column if not exists profile_share_token text;

create table if not exists public.job_shortlist (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (job_id, profile_id)
);

create index if not exists job_shortlist_job_id_idx on public.job_shortlist (job_id);

alter table public.job_shortlist enable row level security;

drop policy if exists "job_shortlist_select_owner" on public.job_shortlist;
create policy "job_shortlist_select_owner"
on public.job_shortlist for select
using (
  public.is_admin()
  or exists (
    select 1 from public.jobs j
    where j.id = job_id and j.created_by = auth.uid()
  )
);

drop policy if exists "job_shortlist_write_admin" on public.job_shortlist;
create policy "job_shortlist_write_admin"
on public.job_shortlist for insert
with check (public.is_admin());

drop policy if exists "job_shortlist_delete_admin" on public.job_shortlist;
create policy "job_shortlist_delete_admin"
on public.job_shortlist for delete
using (public.is_admin());
