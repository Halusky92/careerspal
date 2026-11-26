-- Record whether Google confirmed a publish. Existing rows stay in history and
-- default to unconfirmed, so the first four HTTP 200 sends are not treated as
-- confirmed notifications. This does not notify Google or change jobs.

alter table public.google_index_notifications
  add column if not exists notify_time timestamptz,
  add column if not exists confirmed boolean not null default false;
