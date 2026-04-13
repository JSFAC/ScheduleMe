-- Security event logging + monitoring baseline (safe additive migration)
-- Run in staging first, then production.

begin;

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_type text not null,
  severity text not null default 'info'
    check (severity in ('info', 'warning', 'critical')),
  route text,
  method text,
  status_code integer,
  ip text,
  actor_user_id uuid,
  actor_email text,
  message text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists security_events_created_at_idx
  on public.security_events (created_at desc);

create index if not exists security_events_type_created_idx
  on public.security_events (event_type, created_at desc);

create index if not exists security_events_severity_created_idx
  on public.security_events (severity, created_at desc);

alter table public.security_events enable row level security;

drop policy if exists security_events_service_all on public.security_events;
create policy security_events_service_all
  on public.security_events
  for all
  to service_role
  using (true)
  with check (true);

commit;
