alter table public.businesses add column if not exists city text;
alter table public.businesses add column if not exists zip text;

alter table public.businesses alter column public_visibility set default true;
alter table public.businesses alter column public_show_name set default true;
alter table public.businesses alter column public_show_photos set default true;
alter table public.businesses alter column campus_show_name set default true;

update public.businesses
set
  public_visibility = true,
  public_show_name = true,
  public_show_photos = true,
  campus_show_name = true
where
  approved_at is not null
  or published_at is not null
  or is_onboarded = true;

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
    when 'businesses' then array['phone','website','service_tags','hours','availability_status','break_until','address','description','cover_url','media_urls','video_url','calendly_url','custom_requires_time','city','zip','lat','lng','public_visibility','public_show_name','public_show_photos','campus_show_name']
    when 'services' then array['name','description','price_cents','duration_min','sort_order','active','requires_time']
    when 'bookings' then array['status','dispute_amount_cents','dispute_note','amount_cents','scheduled_start','scheduled_end','scheduled_slot','reviewed','paid_at','customer_proposed_price_cents','provider_proposed_price_cents','price_accepted_by_customer','price_accepted_by_provider','price_accepted_at']
    when 'messages' then array['read']
    when 'reviews' then array['__none__']
    when 'blocks' then array['__none__']
    when 'founder50_allowed_campuses' then array['active','notes']
    when 'campus_featured' then array['slot','starts_at','ends_at','note','notified_on_at','notified_off_at']
    when 'campus_founder50_legacy' then array['__none__']
    when 'campus_founder50_legacy_backup' then array['__none__']
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
