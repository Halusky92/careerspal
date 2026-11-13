-- History of Google Indexing API notifications.
-- The app records a row only after Google accepts a notification.
-- Dry-run does not write. Service role only.

create table if not exists public.google_index_notifications (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  job_id uuid,
  notice_type text not null check (notice_type in ('URL_UPDATED', 'URL_DELETED')),
  fingerprint text,
  http_status integer,
  attempts integer not null default 0,
  state text not null check (state in ('sent', 'failed')),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists google_index_notifications_url_created_idx
  on public.google_index_notifications (url, created_at desc);

create index if not exists google_index_notifications_sent_at_idx
  on public.google_index_notifications (sent_at);

alter table public.google_index_notifications enable row level security;
