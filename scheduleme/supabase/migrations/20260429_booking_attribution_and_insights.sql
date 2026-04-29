alter table public.bookings
  add column if not exists booking_source text,
  add column if not exists booking_source_detail text,
  add column if not exists booking_source_referrer text,
  add column if not exists browse_started_at timestamptz,
  add column if not exists provider_viewed_at timestamptz;
