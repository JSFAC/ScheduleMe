-- ScheduleMe RLS policies (safe to re-run)

-- Enable RLS
alter table public.businesses enable row level security;
alter table public.services enable row level security;
alter table public.reviews enable row level security;
alter table public.bookings enable row level security;
alter table public.messages enable row level security;
alter table public.profiles enable row level security;

-- RLS status helper (used by admin panel)
create or replace function public.get_rls_status(p_tables text[])
returns table (tablename text, rowsecurity boolean)
language sql
security definer
as $$
  select tablename, rowsecurity
  from pg_tables
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

-- Messages: participants read, sender write

drop policy if exists "Messages read by participants" on public.messages;
create policy "Messages read by participants"
on public.messages
for select
to authenticated
using (auth.uid()::text = sender_id::text or auth.uid()::text = receiver_id::text);

drop policy if exists "Messages insert by sender" on public.messages;
create policy "Messages insert by sender"
on public.messages
for insert
to authenticated
with check (auth.uid()::text = sender_id::text);

drop policy if exists "Messages update by sender" on public.messages;
create policy "Messages update by sender"
on public.messages
for update
to authenticated
using (auth.uid()::text = sender_id::text);

drop policy if exists "Messages delete by sender" on public.messages;
create policy "Messages delete by sender"
on public.messages
for delete
to authenticated
using (auth.uid()::text = sender_id::text);

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
