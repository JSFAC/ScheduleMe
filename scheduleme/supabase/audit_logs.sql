-- Audit logging table (best-effort, server-side only)
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  action text not null,
  entity_type text,
  entity_id text,
  actor_id text,
  actor_email text,
  actor_role text,
  ip text,
  user_agent text,
  meta jsonb
);

alter table public.audit_logs enable row level security;

-- Only service role should read/write audit logs
drop policy if exists "Audit logs service role only" on public.audit_logs;
create policy "Audit logs service role only"
on public.audit_logs
for all
to anon, authenticated
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
