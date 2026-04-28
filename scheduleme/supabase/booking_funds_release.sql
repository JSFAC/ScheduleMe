alter table public.bookings
  add column if not exists stripe_transfer_id text,
  add column if not exists funds_released_at timestamptz,
  add column if not exists funds_release_reason text,
  add column if not exists provider_payout_cents integer,
  add column if not exists platform_fee_cents integer;

create index if not exists bookings_funds_released_at_idx
  on public.bookings (funds_released_at);
