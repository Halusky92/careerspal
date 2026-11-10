-- Staging-only ledger for job-first discovery. Do not run against production.
create table if not exists public.sourcing_discovery_usage (
  month_key text primary key,
  search_count integer not null default 0 check (search_count >= 0 and search_count <= 250),
  qualifying_jobs integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.sourcing_discovery_phrases (
  group_id text primary key,
  variant_index integer not null default 0,
  zero_new_streak integer not null default 0,
  cooled_until timestamptz,
  last_new_boards integer not null default 0,
  last_qualifying integer not null default 0,
  runs integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.sourcing_discovery_boards (
  provider text not null,
  identifier text not null,
  decision text not null,
  qualifying_jobs integer not null default 0,
  company_name text,
  found_url text,
  primary key (provider, identifier)
);

alter table public.sourcing_discovery_usage enable row level security;
alter table public.sourcing_discovery_phrases enable row level security;
alter table public.sourcing_discovery_boards enable row level security;

create or replace function public.claim_discovery_search(p_month text, p_cap integer default 250)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count integer;
begin
  if p_cap is null or p_cap < 1 or p_cap > 250 then
    raise exception 'discovery cap must be from 1 to 250';
  end if;
  insert into public.sourcing_discovery_usage (month_key, search_count)
  values (p_month, 0)
  on conflict (month_key) do nothing;
  update public.sourcing_discovery_usage
  set search_count = search_count + 1, updated_at = now()
  where month_key = p_month and search_count < p_cap
  returning search_count into next_count;
  return next_count;
end;
$$;

revoke all on function public.claim_discovery_search(text, integer) from public;
revoke all on function public.claim_discovery_search(text, integer) from anon;
revoke all on function public.claim_discovery_search(text, integer) from authenticated;
grant execute on function public.claim_discovery_search(text, integer) to service_role;
