create table if not exists public.start_pack_ledger (
  id uuid primary key default gen_random_uuid(),
  email text,
  work_domain text,
  company_key text,
  company_id uuid,
  profile_id uuid,
  job_id uuid,
  created_at timestamptz not null default now()
);

create unique index if not exists start_pack_ledger_job_id_uidx
  on public.start_pack_ledger (job_id)
  where job_id is not null;

create index if not exists start_pack_ledger_email_idx on public.start_pack_ledger (email);
create index if not exists start_pack_ledger_company_key_idx on public.start_pack_ledger (company_key);
create index if not exists start_pack_ledger_work_domain_idx on public.start_pack_ledger (work_domain);

alter table public.start_pack_ledger enable row level security;
