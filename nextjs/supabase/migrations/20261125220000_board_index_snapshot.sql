-- Shared board snapshot and a row lease. Service role only.
-- The lease is a timestamp on one row, so it survives Supabase's transaction pooler.
-- Apply before the paged board reads production. This file does not change jobs or companies.

create table if not exists public.board_index_snapshot (
  id text primary key,
  payload jsonb,
  built_at timestamptz,
  source_updated_at timestamptz,
  lease_owner text,
  lease_until timestamptz
);

insert into public.board_index_snapshot (id)
values ('public')
on conflict (id) do nothing;

create index if not exists jobs_updated_at_desc_idx on public.jobs (updated_at desc);

alter table public.board_index_snapshot enable row level security;
alter table public.board_index_snapshot force row level security;

revoke all on table public.board_index_snapshot from public, anon, authenticated;
grant select, update on table public.board_index_snapshot to service_role;

create or replace function public.board_index_claim(owner text, seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed integer;
begin
  update public.board_index_snapshot
  set lease_owner = owner,
      lease_until = now() + make_interval(secs => greatest(seconds, 1))
  where id = 'public'
    and (lease_until is null or lease_until < now());
  get diagnostics claimed = row_count;
  return claimed = 1;
end;
$$;

create or replace function public.board_index_release(owner text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  released integer;
begin
  update public.board_index_snapshot
  set lease_owner = null,
      lease_until = null
  where id = 'public'
    and lease_owner = owner;
  get diagnostics released = row_count;
  return released = 1;
end;
$$;

revoke all on function public.board_index_claim(text, integer) from public, anon, authenticated;
revoke all on function public.board_index_release(text) from public, anon, authenticated;
grant execute on function public.board_index_claim(text, integer) to service_role;
grant execute on function public.board_index_release(text) to service_role;
