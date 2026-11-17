-- Raise the discovery ledger from 620 to 900 basic searches.
-- 30 searches a night stays inside the free 1,000 Tavily credits, with room for a manual call.

alter table public.sourcing_discovery_usage
  drop constraint if exists sourcing_discovery_usage_search_count_check;

alter table public.sourcing_discovery_usage
  add constraint sourcing_discovery_usage_search_count_check
  check (search_count >= 0 and search_count <= 900);

create or replace function public.claim_discovery_search(p_month text, p_cap integer default 900)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count integer;
begin
  if p_cap is null or p_cap < 1 or p_cap > 900 then
    raise exception 'discovery cap must be from 1 to 900';
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
