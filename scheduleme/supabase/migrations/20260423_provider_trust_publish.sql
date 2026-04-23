-- Provider trust controls + publish lifecycle fields

alter table public.businesses
  add column if not exists trust_status text not null default 'clear'
    check (trust_status in ('clear','flagged','warned','requested_info','suspended'));

alter table public.businesses
  add column if not exists trust_flagged boolean not null default false;

alter table public.businesses
  add column if not exists trust_notes text;

alter table public.businesses
  add column if not exists trust_last_action_at timestamptz;

alter table public.businesses
  add column if not exists trust_last_action_by text;

alter table public.businesses
  add column if not exists published_at timestamptz;

create index if not exists businesses_trust_status_idx on public.businesses (trust_status);
create index if not exists businesses_trust_flagged_idx on public.businesses (trust_flagged);
create index if not exists businesses_published_at_idx on public.businesses (published_at desc);

update public.businesses
set trust_status = 'flagged'
where trust_flagged = true
  and trust_status = 'clear';
