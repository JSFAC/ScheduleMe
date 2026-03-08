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
