-- Guard the indexing history. Apply before any live send. This file does not notify Google
-- and does not change jobs, companies, sourcing, or Premium.

alter table public.google_index_notifications enable row level security;
alter table public.google_index_notifications force row level security;
revoke all on table public.google_index_notifications from public, anon, authenticated;
grant select, insert, update on table public.google_index_notifications to service_role;

create index if not exists google_index_notifications_created_at_idx
  on public.google_index_notifications (created_at desc);

create table if not exists public.google_index_digest (
  job_id uuid primary key,
  updated_at timestamptz,
  content_hash text,
  description_sha text,
  visibility text,
  early boolean not null default false,
  checked_at timestamptz not null default now()
);

alter table public.google_index_digest enable row level security;
alter table public.google_index_digest force row level security;
revoke all on table public.google_index_digest from public, anon, authenticated;
grant select, insert, update on table public.google_index_digest to service_role;

create table if not exists public.google_index_run (
  id text primary key,
  owner text,
  lease_until timestamptz
);

insert into public.google_index_run (id)
values ('indexing')
on conflict (id) do nothing;

alter table public.google_index_run enable row level security;
alter table public.google_index_run force row level security;
revoke all on table public.google_index_run from public, anon, authenticated;
grant select, update on table public.google_index_run to service_role;

create or replace function public.google_index_claim(lease_owner text, seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed integer;
begin
  update public.google_index_run
  set owner = lease_owner,
      lease_until = now() + make_interval(secs => greatest(seconds, 1))
  where id = 'indexing'
    and (lease_until is null or lease_until < now());
  get diagnostics claimed = row_count;
  return claimed = 1;
end;
$$;

create or replace function public.google_index_release(lease_owner text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  released integer;
begin
  update public.google_index_run
  set owner = null,
      lease_until = null
  where id = 'indexing'
    and owner = lease_owner;
  get diagnostics released = row_count;
  return released = 1;
end;
$$;

revoke all on function public.google_index_claim(text, integer) from public, anon, authenticated;
revoke all on function public.google_index_release(text) from public, anon, authenticated;
grant execute on function public.google_index_claim(text, integer) to service_role;
grant execute on function public.google_index_release(text) to service_role;
