-- Column-level update guards (defense-in-depth)
-- These triggers prevent authenticated users from updating disallowed columns.
-- Service role is exempt.

create or replace function public.assert_only_columns_changed()
returns trigger
language plpgsql
security definer
as $$
declare
  new_data jsonb := to_jsonb(NEW);
  old_data jsonb := to_jsonb(OLD);
  k text;
  allowed_cols text[];
begin
  if auth.role() = 'service_role' then
    return NEW;
  end if;

  allowed_cols := case TG_TABLE_NAME
    when 'profiles' then array['name','phone','avatar_url','preferred_contact','service_radius','notifications']
    when 'businesses' then array['phone','website','service_tags','hours','availability_status','break_until','address','description','cover_url','media_urls','video_url','calendly_url','custom_requires_time']
    when 'services' then array['name','description','price_cents','duration_min','sort_order','active','requires_time']
    when 'bookings' then array['status','dispute_amount_cents','dispute_note','amount_cents','scheduled_start','scheduled_end','scheduled_slot','reviewed','paid_at','customer_proposed_price_cents','provider_proposed_price_cents','price_accepted_by_customer','price_accepted_by_provider','price_accepted_at']
    when 'messages' then array['read']
    when 'reviews' then array['__none__']
    when 'blocks' then array['__none__']
    else null
  end;

  if allowed_cols is null then
    raise exception 'No column guard list defined for table "%" ', TG_TABLE_NAME;
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
execute function public.assert_only_columns_changed();

-- Businesses: allow owner-editable fields only
drop trigger if exists trg_businesses_column_guard on public.businesses;
create trigger trg_businesses_column_guard
before update on public.businesses
for each row
execute function public.assert_only_columns_changed();

-- Services: allow editable service fields
drop trigger if exists trg_services_column_guard on public.services;
create trigger trg_services_column_guard
before update on public.services
for each row
execute function public.assert_only_columns_changed();

-- Bookings: allow limited status/dispute fields
drop trigger if exists trg_bookings_column_guard on public.bookings;
create trigger trg_bookings_column_guard
before update on public.bookings
for each row
execute function public.assert_only_columns_changed();

-- Messages: allow read flag only
drop trigger if exists trg_messages_column_guard on public.messages;
create trigger trg_messages_column_guard
before update on public.messages
for each row
execute function public.assert_only_columns_changed();

-- Reviews: block updates (service role can still modify)
drop trigger if exists trg_reviews_column_guard on public.reviews;
create trigger trg_reviews_column_guard
before update on public.reviews
for each row
execute function public.assert_only_columns_changed();

-- Blocks: block updates (use delete + insert only)
drop trigger if exists trg_blocks_column_guard on public.blocks;
create trigger trg_blocks_column_guard
before update on public.blocks
for each row
execute function public.assert_only_columns_changed();

-- Helper: check if column guard triggers are installed
create or replace function public.get_column_guard_status(p_tables text[])
returns table(tablename text, has_guard boolean)
language sql
security definer
as $$
  select t.table_name as tablename,
    exists (
      select 1
      from pg_trigger trg
      join pg_class cls on cls.oid = trg.tgrelid
      where not trg.tgisinternal
        and cls.relname = t.table_name
        and trg.tgname like '%column_guard%'
        and trg.tgenabled <> 'D'
    ) as has_guard
  from unnest(p_tables) as t(table_name);
$$;
