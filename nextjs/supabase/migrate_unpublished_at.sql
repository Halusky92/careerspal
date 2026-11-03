-- Optional: timestamp for when a listing left the live board.
-- Used to keep unpublished jobs 90 days for paid renewal, then weekly delete.
alter table public.jobs
  add column if not exists unpublished_at timestamptz;

create index if not exists jobs_unpublished_at_idx on public.jobs (unpublished_at);
