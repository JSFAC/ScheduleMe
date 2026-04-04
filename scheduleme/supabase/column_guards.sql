-- Column-level update guards (defense-in-depth)
-- These triggers prevent authenticated users from updating disallowed columns.
-- Service role is exempt.

create or replace function public.assert_only_columns_changed(allowed_cols text[])
returns trigger
language plpgsql
security definer
as $$
declare
  new_data jsonb := to_jsonb(NEW);
  old_data jsonb := to_jsonb(OLD);
  k text;
begin
  if auth.role() = 'service_role' then
    return NEW;
  end if;

  for k in select jsonb_object_keys(new_data)
  loop
    if (new_data -> k) is distinct from (old_data -> k) then
      if not (k = any(allowed_cols)) then
        raise exception 'Update to column "%" is not allowed', k;
      end if;
    end if;
  end loop;

  return NEW;
end;
$$;

-- Profiles: allow only basic personal fields
drop trigger if exists trg_profiles_column_guard on public.profiles;
create trigger trg_profiles_column_guard
before update on public.profiles
for each row
execute function public.assert_only_columns_changed(array[
  'name','phone','avatar_url','preferred_contact','service_radius','notifications'
]);

-- Businesses: allow owner-editable fields only
drop trigger if exists trg_businesses_column_guard on public.businesses;
create trigger trg_businesses_column_guard
before update on public.businesses
for each row
execute function public.assert_only_columns_changed(array[
  'phone','website','service_tags','hours','availability_status','break_until',
  'address','description','cover_url','media_urls','video_url','calendly_url',
  'custom_requires_time'
]);

-- Services: allow editable service fields
drop trigger if exists trg_services_column_guard on public.services;
create trigger trg_services_column_guard
before update on public.services
for each row
execute function public.assert_only_columns_changed(array[
  'name','description','price_cents','duration_min','sort_order','active','requires_time'
]);

-- Bookings: allow limited status/dispute fields
drop trigger if exists trg_bookings_column_guard on public.bookings;
create trigger trg_bookings_column_guard
before update on public.bookings
for each row
execute function public.assert_only_columns_changed(array[
  'status','dispute_amount_cents','dispute_note','amount_cents','scheduled_start',
  'scheduled_end','scheduled_slot','reviewed','paid_at'
]);

-- Messages: allow read flag only
drop trigger if exists trg_messages_column_guard on public.messages;
create trigger trg_messages_column_guard
before update on public.messages
for each row
execute function public.assert_only_columns_changed(array[
  'read'
]);

-- Reviews: block updates (service role can still modify)
drop trigger if exists trg_reviews_column_guard on public.reviews;
create trigger trg_reviews_column_guard
before update on public.reviews
for each row
execute function public.assert_only_columns_changed(array[]::text[]);

-- Blocks: block updates (use delete + insert only)
drop trigger if exists trg_blocks_column_guard on public.blocks;
create trigger trg_blocks_column_guard
before update on public.blocks
for each row
execute function public.assert_only_columns_changed(array[]::text[]);
