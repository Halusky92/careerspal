-- CareersPal Premium column guard
-- Local / staging only until explicitly approved for production.
-- Does not drop columns or rewrite existing profile data.

alter table public.profiles add column if not exists board_premium_until timestamptz;
alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.profiles add column if not exists stripe_subscription_id text;
alter table public.profiles add column if not exists stripe_subscription_status text;
alter table public.profiles add column if not exists newsletter_opt_in boolean not null default false;

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  profile_id uuid references public.profiles(id) on delete set null,
  received_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;

drop policy if exists "stripe_webhook_events_admin_select" on public.stripe_webhook_events;
create policy "stripe_webhook_events_admin_select"
on public.stripe_webhook_events for select
using (public.is_admin());

revoke all on public.stripe_webhook_events from anon, authenticated;
grant select on public.stripe_webhook_events to authenticated;

create or replace function public.protect_profile_billing_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text;
begin
  jwt_role := coalesce(auth.role(), '');
  if jwt_role = 'service_role' then
    return new;
  end if;
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.board_premium_until := null;
    new.stripe_customer_id := null;
    new.stripe_subscription_id := null;
    new.stripe_subscription_status := null;
    return new;
  end if;

  new.board_premium_until := old.board_premium_until;
  new.stripe_customer_id := old.stripe_customer_id;
  new.stripe_subscription_id := old.stripe_subscription_id;
  new.stripe_subscription_status := old.stripe_subscription_status;
  return new;
end;
$$;

drop trigger if exists profiles_protect_billing_columns on public.profiles;
create trigger profiles_protect_billing_columns
before insert or update on public.profiles
for each row
execute function public.protect_profile_billing_columns();

revoke update on table public.profiles from anon, authenticated;
grant update (
  email,
  role,
  full_name,
  avatar_url,
  headline,
  bio,
  hobbies,
  is_onboarded,
  profile_visibility,
  profile_share_token,
  newsletter_opt_in
) on table public.profiles to authenticated;
