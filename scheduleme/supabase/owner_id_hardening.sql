-- Owner ID hardening for provider-owned businesses.
-- Run this in production only after confirming all provider accounts exist in auth/profiles.

begin;

-- 1) Ensure owner_id exists and is indexed.
alter table public.businesses
  add column if not exists owner_id uuid;

create index if not exists businesses_owner_id_idx
  on public.businesses(owner_id);

-- 2) Backfill owner_id from profiles by owner_email.
update public.businesses b
set owner_id = p.id
from public.profiles p
where b.owner_id is null
  and b.owner_email is not null
  and lower(p.email) = lower(b.owner_email);

-- 3) Backfill remaining from legacy users table by owner_email.
update public.businesses b
set owner_id = u.id
from public.users u
where b.owner_id is null
  and b.owner_email is not null
  and lower(u.email) = lower(b.owner_email);

-- 4) Add FK to auth.users if missing.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'businesses_owner_id_fkey'
      and conrelid = 'public.businesses'::regclass
  ) then
    alter table public.businesses
      add constraint businesses_owner_id_fkey
      foreign key (owner_id) references auth.users(id) on delete restrict;
  end if;
end $$;

-- 5) Validate all rows before forcing NOT NULL.
do $$
declare
  missing_count integer;
begin
  select count(*) into missing_count
  from public.businesses
  where owner_id is null;

  if missing_count > 0 then
    raise exception 'owner_id backfill incomplete: % business rows still missing owner_id', missing_count;
  end if;
end $$;

alter table public.businesses
  alter column owner_id set not null;

commit;

-- Helpful verification query:
-- select id, name, owner_email, owner_id from public.businesses order by created_at desc;
