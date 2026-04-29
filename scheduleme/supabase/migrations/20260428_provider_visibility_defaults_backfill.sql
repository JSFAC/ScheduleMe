-- Normalize provider visibility defaults for current and future provider rows.
-- Goal:
-- 1. Existing live/legacy providers should show identity/media by default.
-- 2. Future provider rows should default to visible name/photo behavior once live.
-- 3. Preserve true drafts and explicit modern unpublishes.

alter table public.businesses
  add column if not exists public_show_name boolean;

alter table public.businesses
  add column if not exists public_show_photos boolean;

alter table public.businesses
  add column if not exists campus_show_name boolean;

alter table public.businesses
  alter column public_show_name set default true;

alter table public.businesses
  alter column public_show_photos set default true;

alter table public.businesses
  alter column campus_show_name set default true;

do $$
begin
  -- If an older schema still has public_show_media, use it as the first
  -- compatibility source before falling back to visible-by-default.
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'businesses'
      and column_name = 'public_show_media'
  ) then
    execute $sql$
      update public.businesses
      set public_show_photos = coalesce(public_show_photos, public_show_media, true)
      where public_show_photos is null
    $sql$;
  else
    update public.businesses
    set public_show_photos = true
    where public_show_photos is null;
  end if;
end $$;

update public.businesses
set public_show_name = true
where public_show_name is null;

update public.businesses
set campus_show_name = true
where campus_show_name is null;

-- Backfill existing live/legacy providers so they are fully visible by default.
-- Include:
-- - modern published providers
-- - legacy approved providers from before the publish flow
-- - currently public providers
update public.businesses
set
  public_show_name = true,
  public_show_photos = true,
  campus_show_name = true
where
  coalesce(public_visibility, false) = true
  or published_at is not null
  or (approved_at is not null and published_at is null);

-- Legacy approved providers were historically treated as public even when
-- public_visibility was false before publish lifecycle fields existed.
-- Promote only those legacy rows, while preserving explicit modern unpublishes.
update public.businesses
set public_visibility = true
where
  approved_at is not null
  and published_at is null
  and coalesce(public_visibility, false) = false;
