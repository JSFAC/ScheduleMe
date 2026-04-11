-- ============================================================
-- ScheduleMe — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Enable PostGIS extension (only needed once per project)
create extension if not exists postgis;

-- ============================================================
-- 1. BUSINESSES
-- ============================================================
create table if not exists businesses (
  id                        uuid primary key default gen_random_uuid(),
  name                      text not null,
  slug                      text unique,
  description               text,
  address                   text,
  lat                       double precision,
  lng                       double precision,
  geog                      geography(Point, 4326),        -- auto-populated via trigger
  service_tags              text[],                        -- e.g. ['plumbing','hvac']
  keywords                  text[],                        -- extra search terms
  price_tier                smallint check (price_tier between 1 and 4),
  rating                    numeric(2,1) default 0,
  calendly_url              text,
  google_calendar_enabled   boolean default false,
  google_refresh_token      text,
  google_access_token       text,
  google_token_expires_at   timestamptz,
  stripe_account_id         text,
  is_onboarded              boolean default false,
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);

-- ============================================================
-- 2b. BUSINESS CHANGE REQUESTS (ADMIN REVIEW)
-- ============================================================
create table if not exists business_change_requests (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid references businesses(id) on delete cascade,
  requested_by  text,
  request_type  text, -- e.g., profile, media
  status        text default 'pending', -- pending, approved, rejected, auto_applied
  changes       jsonb not null,
  before        jsonb,
  flagged       boolean default false,
  flag_reasons  text[] default '{}',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  reviewed_at   timestamptz,
  reviewed_by   text,
  review_notes  text
);

create index if not exists business_change_requests_business_idx on business_change_requests (business_id);
create index if not exists business_change_requests_status_idx on business_change_requests (status);
create index if not exists business_change_requests_created_idx on business_change_requests (created_at desc);


-- GIST index for fast geo queries
create index if not exists businesses_geog_idx
  on businesses using gist (geog);

-- Full-text search index across name + description + keywords
create index if not exists businesses_fts_idx
  on businesses using gin (
    to_tsvector('english',
      coalesce(name, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(array_to_string(keywords, ' '), '')
    )
  );

-- Index on service_tags for fast array filtering
create index if not exists businesses_service_tags_idx
  on businesses using gin (service_tags);

-- ── Trigger: auto-populate geog from lat/lng ──────────────
create or replace function businesses_set_geog()
returns trigger language plpgsql as $$
begin
  if new.lat is not null and new.lng is not null then
    new.geog := st_makepoint(new.lng, new.lat)::geography;
  end if;
  return new;
end;
$$;

drop trigger if exists businesses_geog_trigger on businesses;
create trigger businesses_geog_trigger
  before insert or update of lat, lng on businesses
  for each row execute function businesses_set_geog();

-- ── Trigger: auto-update updated_at ──────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists businesses_updated_at on businesses;
create trigger businesses_updated_at
  before update on businesses
  for each row execute function set_updated_at();


-- Add EDU verification columns (if not exists)
alter table businesses add column if not exists school_domain text;
alter table businesses add column if not exists school_email text;
alter table businesses add column if not exists owner_id uuid references auth.users(id) on delete restrict;
alter table businesses add column if not exists edu_verified boolean default false;
alter table businesses add column if not exists edu_code text;
alter table businesses add column if not exists edu_code_expires_at timestamptz;
alter table businesses add column if not exists campus_provider boolean default false;
alter table businesses add column if not exists campus_school_name text;
alter table businesses add column if not exists campus_key text;
alter table businesses add column if not exists founder50 boolean default false;
alter table businesses add column if not exists founder50_status text default 'active';
alter table businesses add column if not exists bookings_completed integer default 0;
alter table businesses add column if not exists last_completed_booking_at timestamptz;
alter table businesses add column if not exists away_start timestamptz;
alter table businesses add column if not exists away_end timestamptz;
alter table businesses add column if not exists featured_until timestamptz;
alter table businesses add column if not exists featured_reason text;
alter table businesses add column if not exists featured_on_notified_at timestamptz;
alter table businesses add column if not exists featured_off_notified_at timestamptz;

create index if not exists businesses_campus_key_idx on businesses (campus_key);
create index if not exists businesses_owner_id_idx on businesses (owner_id);
create index if not exists businesses_founder50_status_idx on businesses (founder50_status);
create index if not exists businesses_featured_until_idx on businesses (featured_until);

-- Campus allowlist for Founder50 assignment.
-- Keep UCSC active; add more campuses only when you intentionally expand Founder50.
create table if not exists founder50_allowed_campuses (
  campus_key   text primary key,
  active       boolean not null default true,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists founder50_allowed_active_idx on founder50_allowed_campuses (active);

drop trigger if exists founder50_allowed_updated_at on founder50_allowed_campuses;
create trigger founder50_allowed_updated_at
  before update on founder50_allowed_campuses
  for each row execute function set_updated_at();

insert into founder50_allowed_campuses (campus_key, active, notes)
values ('ucsc', true, 'Launch campus')
on conflict (campus_key) do nothing;

-- Atomic Founder50 assignment.
-- Enforces eligibility + 50-cap in the database to prevent race conditions.
create or replace function assign_founder50_if_eligible(p_business_id uuid)
returns table (assigned boolean, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  b record;
  normalized_key text;
  founder_count integer;
  updated_count integer;
begin
  if p_business_id is null then
    return query select false, 'missing_business_id';
    return;
  end if;

  select id, founder50, campus_provider, campus_key, campus_school_name, edu_verified
  into b
  from businesses
  where id = p_business_id
  for update;

  if not found then
    return query select false, 'missing_business';
    return;
  end if;

  if coalesce(b.founder50, false) then
    return query select false, 'already_founder50';
    return;
  end if;
  if not coalesce(b.campus_provider, false) then
    return query select false, 'not_campus_provider';
    return;
  end if;
  if not coalesce(b.edu_verified, false) then
    return query select false, 'not_edu_verified';
    return;
  end if;

  normalized_key := lower(trim(coalesce(b.campus_key, b.campus_school_name, '')));
  normalized_key := regexp_replace(normalized_key, '[^a-z0-9.]+', '_', 'g');
  normalized_key := regexp_replace(normalized_key, '^_+|_+$', '', 'g');
  if normalized_key in ('ucsc', 'ucsc.edu', 'uc_santa_cruz', 'university_of_california_santa_cruz') then
    normalized_key := 'ucsc';
  end if;
  if normalized_key = '' then
    return query select false, 'missing_campus_key';
    return;
  end if;

  if not exists (
    select 1 from founder50_allowed_campuses
    where campus_key = normalized_key and active = true
  ) then
    return query select false, 'campus_not_allowlisted';
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('founder50:' || normalized_key));

  select count(*)
  into founder_count
  from businesses
  where campus_provider = true
    and campus_key = normalized_key
    and founder50 = true;

  if founder_count >= 50 then
    return query select false, 'campus_full';
    return;
  end if;

  update businesses
  set campus_key = normalized_key,
      founder50 = true,
      founder50_status = 'active'
  where id = p_business_id
    and founder50 = false;

  get diagnostics updated_count = row_count;
  if updated_count = 1 then
    return query select true, null::text;
  else
    return query select false, 'update_failed';
  end if;
end;
$$;

grant execute on function assign_founder50_if_eligible(uuid) to service_role;


-- ============================================================
-- 2. USERS
-- ============================================================
create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  email       text unique not null,
  name        text,
  phone       text,
  created_at  timestamptz default now()
);


-- ============================================================
-- 3. BOOKINGS
-- ============================================================
create table if not exists bookings (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid references users(id) on delete set null,
  business_id              uuid references businesses(id) on delete set null,
  service                  text,
  note                     text,
  scheduled_start          timestamptz,
  scheduled_end            timestamptz,
  timezone                 text default 'America/Chicago',
  status                   text default 'pending'
                             check (status in ('pending','confirmed','cancelled','completed')),
  stripe_payment_intent_id text,
  requires_manual_action   boolean default false,
  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);

create index if not exists bookings_user_idx     on bookings (user_id);
create index if not exists bookings_business_idx on bookings (business_id);
create index if not exists bookings_status_idx   on bookings (status);

drop trigger if exists bookings_updated_at on bookings;
create trigger bookings_updated_at
  before update on bookings
  for each row execute function set_updated_at();

-- Optional pricing workflow fields (safe to re-run)
alter table bookings add column if not exists customer_proposed_price_cents integer;
alter table bookings add column if not exists provider_proposed_price_cents integer;
alter table bookings add column if not exists price_accepted_by_customer boolean default false;
alter table bookings add column if not exists price_accepted_by_provider boolean default false;
alter table bookings add column if not exists price_accepted_at timestamptz;
alter table bookings add column if not exists protection_fee_cents integer default 99;


-- ============================================================
-- 3b. CAMPUS FEATURED (MANUAL SPOTLIGHT)
-- ============================================================
create table if not exists campus_featured (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid references businesses(id) on delete cascade,
  campus_key        text not null,
  slot              smallint default 1,
  starts_at         timestamptz default now(),
  ends_at           timestamptz default (now() + interval '7 days'),
  note              text,
  created_at        timestamptz default now(),
  created_by        text,
  notified_on_at    timestamptz,
  notified_off_at   timestamptz
);

create index if not exists campus_featured_campus_idx on campus_featured (campus_key);
create index if not exists campus_featured_dates_idx on campus_featured (starts_at, ends_at);


-- ============================================================
-- 4. PostGIS GEO SEARCH RPC
-- ============================================================
-- Usage: supabase.rpc('search_businesses_geo', { p_lat, p_lng, ... })
-- Distances returned in miles.
-- ============================================================
create or replace function search_businesses_geo(
  p_lat         double precision,
  p_lng         double precision,
  p_service     text    default null,
  p_term        text    default null,
  p_price_max   integer default null,
  p_radius      double precision default 25, -- miles
  p_limit       integer default 40
)
returns table (
  id            uuid,
  name          text,
  slug          text,
  description   text,
  address       text,
  lat           double precision,
  lng           double precision,
  service_tags  text[],
  price_tier    smallint,
  rating        numeric,
  calendly_url  text,
  is_onboarded  boolean,
  distance_miles double precision
)
language sql stable as $$
  select
    b.id,
    b.name,
    b.slug,
    b.description,
    b.address,
    b.lat,
    b.lng,
    b.service_tags,
    b.price_tier,
    b.rating,
    b.calendly_url,
    b.is_onboarded,
    -- ST_Distance returns meters on geography; convert to miles
    round((st_distance(b.geog, st_makepoint(p_lng, p_lat)::geography) / 1609.344)::numeric, 2)::double precision
      as distance_miles
  from businesses b
  where
    b.geog is not null
    and b.is_onboarded = true
    -- radius filter (miles → meters)
    and st_dwithin(
      b.geog,
      st_makepoint(p_lng, p_lat)::geography,
      p_radius * 1609.344
    )
    -- service tag filter (null = no filter)
    and (
      p_service is null
      or b.service_tags @> array[lower(p_service)]
    )
    -- full-text search (null = no filter)
    and (
      p_term is null
      or to_tsvector('english',
           coalesce(b.name, '') || ' ' ||
           coalesce(b.description, '') || ' ' ||
           coalesce(array_to_string(b.keywords, ' '), '')
         ) @@ plainto_tsquery('english', p_term)
    )
    -- price tier filter (null = no filter)
    and (p_price_max is null or b.price_tier <= p_price_max)
  order by distance_miles asc
  limit p_limit;
$$;

-- Grant execute to anon and authenticated roles
grant execute on function search_businesses_geo to anon, authenticated;


-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================

-- Businesses: public read, service_role write
alter table businesses enable row level security;
create policy "businesses_public_read"
  on businesses for select using (true);
create policy "businesses_service_write"
  on businesses for all using (auth.role() = 'service_role');

-- Business change requests: service_role only
alter table business_change_requests enable row level security;
create policy "change_requests_service_all"
  on business_change_requests for all using (auth.role() = 'service_role');

-- Users: users can only read/update their own row
alter table users enable row level security;
create policy "users_own_row"
  on users for all using (auth.uid() = id);
create policy "users_service_all"
  on users for all using (auth.role() = 'service_role');

-- Bookings: user sees their own, business can see theirs via service_role
alter table bookings enable row level security;
create policy "bookings_own"
  on bookings for select using (auth.uid() = user_id);
create policy "bookings_service_all"
  on bookings for all using (auth.role() = 'service_role');


-- ============================================================
-- v2 ADDITIONS — run after initial schema
-- ============================================================

-- Add phone column to businesses (if not exists)
alter table businesses add column if not exists phone text;
alter table businesses add column if not exists owner_name text;
alter table businesses add column if not exists owner_email text;

-- Update the search RPC to include phone
create or replace function search_businesses_geo(
  p_lat         double precision,
  p_lng         double precision,
  p_service     text    default null,
  p_term        text    default null,
  p_price_max   integer default null,
  p_radius      double precision default 25,
  p_limit       integer default 40
)
returns table (
  id            uuid,
  name          text,
  slug          text,
  description   text,
  address       text,
  lat           double precision,
  lng           double precision,
  service_tags  text[],
  price_tier    smallint,
  rating        numeric,
  calendly_url  text,
  phone         text,
  is_onboarded  boolean,
  distance_miles double precision
)
language sql stable as $$
  select
    b.id, b.name, b.slug, b.description, b.address, b.lat, b.lng,
    b.service_tags, b.price_tier, b.rating, b.calendly_url, b.phone, b.is_onboarded,
    round((st_distance(b.geog, st_makepoint(p_lng, p_lat)::geography) / 1609.344)::numeric, 2)::double precision as distance_miles
  from businesses b
  where
    b.geog is not null and b.is_onboarded = true
    and st_dwithin(b.geog, st_makepoint(p_lng, p_lat)::geography, p_radius * 1609.344)
    and (p_service is null or b.service_tags @> array[lower(p_service)])
    and (p_term is null or to_tsvector('english', coalesce(b.name,'') || ' ' || coalesce(b.description,'') || ' ' || coalesce(array_to_string(b.keywords,' '),'')) @@ plainto_tsquery('english', p_term))
    and (p_price_max is null or b.price_tier <= p_price_max)
  order by distance_miles asc
  limit p_limit;
$$;

grant execute on function search_businesses_geo to anon, authenticated;

-- Allow service_role to write users (for lead capture)
do $$
begin
  if to_regclass('public.users') is not null then
    execute 'alter table public.users enable row level security';
    execute 'drop policy if exists "users_service_insert" on public.users';
    execute 'create policy "users_service_insert" on public.users for insert to authenticated with check (auth.role() = ''service_role'')';
  end if;
end $$;


-- ============================================================
-- 5. SERVICES (Business service menu items)
-- ============================================================
create table if not exists services (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid references businesses(id) on delete cascade,
  name         text not null,
  description  text,
  price_cents  integer not null check (price_cents >= 0),
  duration_min integer default 60,
  sort_order   integer default 0,
  active       boolean default true,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists services_business_idx on services (business_id);

drop trigger if exists services_updated_at on services;
create trigger services_updated_at
  before update on services
  for each row execute function set_updated_at();
