-- Monitoring expansion: client/server error tracker with triage workflow
-- Run in staging first, then production.

begin;

create table if not exists public.app_errors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  source text not null default 'client' check (source in ('client', 'server')),
  severity text not null default 'error' check (severity in ('info', 'warning', 'error', 'critical')),
  status text not null default 'open' check (status in ('open', 'investigating', 'resolved', 'muted')),
  fingerprint text not null unique,
  message text not null,
  route text,
  component text,
  user_agent text,
  sample_stack text,
  sample_payload jsonb not null default '{}'::jsonb,
  occurrences integer not null default 1,
  affected_users integer not null default 0,
  last_actor_user_id uuid,
  last_actor_email text,
  notes text,
  resolution_notes text,
  resolved_at timestamptz
);

create index if not exists app_errors_last_seen_idx
  on public.app_errors (last_seen desc);

create index if not exists app_errors_status_last_seen_idx
  on public.app_errors (status, last_seen desc);

create index if not exists app_errors_severity_last_seen_idx
  on public.app_errors (severity, last_seen desc);

alter table public.app_errors enable row level security;

drop policy if exists app_errors_service_all on public.app_errors;
create policy app_errors_service_all
  on public.app_errors
  for all
  to service_role
  using (true)
  with check (true);

create or replace function public.app_errors_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists app_errors_updated_at on public.app_errors;
create trigger app_errors_updated_at
before update on public.app_errors
for each row execute function public.app_errors_set_updated_at();

commit;
