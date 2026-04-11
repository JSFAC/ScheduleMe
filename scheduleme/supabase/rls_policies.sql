-- ScheduleMe RLS policies (safe to re-run)

-- Enable RLS
alter table public.businesses enable row level security;
alter table public.services enable row level security;
alter table public.reviews enable row level security;
alter table public.bookings enable row level security;
alter table public.messages enable row level security;
alter table public.profiles enable row level security;
alter table public.founder50_allowed_campuses enable row level security;
alter table public.campus_featured enable row level security;

do $$
begin
  if to_regclass('public.blocks') is not null then
    execute 'alter table public.blocks enable row level security';
  end if;
end $$;

-- Ensure owner_id exists before owner-based policies are created.
alter table public.businesses add column if not exists owner_id uuid;

-- RLS status helper (used by admin panel)
create or replace function public.get_rls_status(p_tables text[])
returns table (tablename text, rowsecurity boolean)
language sql
security definer
set search_path = public, pg_catalog
as $$
  select tablename, rowsecurity
  from pg_catalog.pg_tables
  where schemaname = 'public'
    and tablename = any(p_tables)
  order by tablename;
$$;

-- Businesses: public read (discovery)
drop policy if exists "Public can read businesses" on public.businesses;
create policy "Public can read businesses"
on public.businesses
for select
to anon, authenticated
using (true);

drop policy if exists "Businesses insert by owner_id" on public.businesses;
create policy "Businesses insert by owner_id"
on public.businesses
for insert
to authenticated
with check (owner_id::text = auth.uid()::text);

drop policy if exists "Businesses update by owner_id" on public.businesses;
create policy "Businesses update by owner_id"
on public.businesses
for update
to authenticated
using (owner_id::text = auth.uid()::text)
with check (owner_id::text = auth.uid()::text);

drop policy if exists "Businesses delete by owner_id" on public.businesses;
create policy "Businesses delete by owner_id"
on public.businesses
for delete
to authenticated
using (owner_id::text = auth.uid()::text);

-- Internal-only tables: service_role only
do $$
begin
  if to_regclass('public.blocks') is not null then
    execute 'drop policy if exists "Blocks service role only" on public.blocks';
    execute 'create policy "Blocks service role only" on public.blocks for all to anon, authenticated using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')';
    execute 'revoke all on table public.blocks from anon, authenticated';
  end if;
end $$;

drop policy if exists "Founder50 allowlist service role only" on public.founder50_allowed_campuses;
create policy "Founder50 allowlist service role only"
on public.founder50_allowed_campuses
for all
to anon, authenticated
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Campus featured service role only" on public.campus_featured;
create policy "Campus featured service role only"
on public.campus_featured
for all
to anon, authenticated
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

do $$
begin
  if to_regclass('public.campus_founder50_legacy') is not null then
    execute 'alter table public.campus_founder50_legacy enable row level security';
    execute 'drop policy if exists "Campus founder50 legacy service role only" on public.campus_founder50_legacy';
    execute 'create policy "Campus founder50 legacy service role only" on public.campus_founder50_legacy for all to anon, authenticated using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')';
    execute 'revoke all on table public.campus_founder50_legacy from anon, authenticated';
  end if;
end $$;

-- Defense in depth: remove direct grants for anon/authenticated
revoke all on table public.founder50_allowed_campuses from anon, authenticated;
revoke all on table public.campus_featured from anon, authenticated;

-- Services: public read
drop policy if exists "Public can read services" on public.services;
create policy "Public can read services"
on public.services
for select
to anon, authenticated
using (true);

-- Reviews: public read, owner write

drop policy if exists "Public can read reviews" on public.reviews;
create policy "Public can read reviews"
on public.reviews
for select
to anon, authenticated
using (true);

drop policy if exists "Reviews insert by owner" on public.reviews;
create policy "Reviews insert by owner"
on public.reviews
for insert
to authenticated
with check (auth.uid()::text = user_id::text);

drop policy if exists "Reviews update by owner" on public.reviews;
create policy "Reviews update by owner"
on public.reviews
for update
to authenticated
using (auth.uid()::text = user_id::text);

drop policy if exists "Reviews delete by owner" on public.reviews;
create policy "Reviews delete by owner"
on public.reviews
for delete
to authenticated
using (auth.uid()::text = user_id::text);

-- Messages: participants read/write (via booking + business owner_id)

drop policy if exists "Messages read by participants" on public.messages;
create policy "Messages read by participants"
on public.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings b
    join public.businesses biz on biz.id = b.business_id
    where b.id = messages.booking_id
      and (
        b.user_id::text = auth.uid()::text
        or biz.owner_id::text = auth.uid()::text
      )
  )
);

-- Profiles: users can read/update their own profile
drop policy if exists "Profiles select own" on public.profiles;
create policy "Profiles select own"
on public.profiles
for select
to authenticated
using (auth.uid()::text = id::text);

drop policy if exists "Profiles update own" on public.profiles;
create policy "Profiles update own"
on public.profiles
for update
to authenticated
using (auth.uid()::text = id::text);

drop policy if exists "Profiles insert own" on public.profiles;
create policy "Profiles insert own"
on public.profiles
for insert
to authenticated
with check (auth.uid()::text = id::text);

drop policy if exists "Messages insert by sender" on public.messages;
create policy "Messages insert by sender"
on public.messages
for insert
to authenticated
with check (
  exists (
    select 1
    from public.bookings b
    join public.businesses biz on biz.id = b.business_id
    where b.id = messages.booking_id
      and (
        b.user_id::text = auth.uid()::text
        or biz.owner_id::text = auth.uid()::text
      )
  )
);

drop policy if exists "Messages update by sender" on public.messages;
create policy "Messages update by sender"
on public.messages
for update
to authenticated
using (
  exists (
    select 1
    from public.bookings b
    join public.businesses biz on biz.id = b.business_id
    where b.id = messages.booking_id
      and (
        b.user_id::text = auth.uid()::text
        or biz.owner_id::text = auth.uid()::text
      )
  )
);

drop policy if exists "Messages delete by sender" on public.messages;
create policy "Messages delete by sender"
on public.messages
for delete
to authenticated
using (
  exists (
    select 1
    from public.bookings b
    join public.businesses biz on biz.id = b.business_id
    where b.id = messages.booking_id
      and (
        b.user_id::text = auth.uid()::text
        or biz.owner_id::text = auth.uid()::text
      )
  )
);

-- Storage buckets (example policies)
-- Adjust bucket_id names to match your project

drop policy if exists "Message media upload by owner" on storage.objects;
create policy "Message media upload by owner"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'message-media'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- If you want public read for message media, keep this policy:
drop policy if exists "Message media read by anyone" on storage.objects;
create policy "Message media read by anyone"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'message-media');

drop policy if exists "Review media upload by owner" on storage.objects;
create policy "Review media upload by owner"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'review-media'
  and auth.uid()::text = (storage.foldername(name))[1]
);
