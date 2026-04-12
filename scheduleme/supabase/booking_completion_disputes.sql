-- Booking completion proof + consumer dispute window
-- Safe to run multiple times.

alter table public.bookings
  add column if not exists completed_at timestamptz,
  add column if not exists completion_proof_note text,
  add column if not exists completion_proof_photo_urls text[] default '{}'::text[],
  add column if not exists completion_proof_geo_metadata jsonb,
  add column if not exists completion_proof_submitted_at timestamptz,
  add column if not exists completion_proof_submitted_by uuid,
  add column if not exists consumer_confirmation_due_at timestamptz,
  add column if not exists consumer_confirmation_mode text,
  add column if not exists disputed_at timestamptz,
  add column if not exists dispute_reason text,
  add column if not exists dispute_details text,
  add column if not exists dispute_media_urls text[] default '{}'::text[],
  add column if not exists dispute_opened_by uuid;

do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
      and pg_get_constraintdef(oid) ilike '%pending%'
  loop
    execute format('alter table public.bookings drop constraint if exists %I', c.conname);
  end loop;
end $$;

alter table public.bookings
  add constraint bookings_status_check
  check (
    status in (
      'pending',
      'confirmed',
      'active',
      'payment_pending',
      'paid',
      'price_disputed',
      'completed',
      'disputed',
      'cancelled',
      'payment_failed'
    )
  );

create index if not exists bookings_consumer_confirmation_due_at_idx
  on public.bookings (consumer_confirmation_due_at);

create index if not exists bookings_disputed_at_idx
  on public.bookings (disputed_at);

create or replace function public.enforce_booking_completion_proof_immutable()
returns trigger
language plpgsql
as $$
begin
  if old.completion_proof_submitted_at is not null then
    if new.completion_proof_submitted_at is distinct from old.completion_proof_submitted_at then
      raise exception 'completion_proof_submitted_at is immutable once set';
    end if;
    if new.completion_proof_submitted_by is distinct from old.completion_proof_submitted_by then
      raise exception 'completion_proof_submitted_by is immutable once set';
    end if;
    if new.completion_proof_note is distinct from old.completion_proof_note
      or new.completion_proof_photo_urls is distinct from old.completion_proof_photo_urls
      or new.completion_proof_geo_metadata is distinct from old.completion_proof_geo_metadata then
      raise exception 'completion proof is immutable once submitted';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bookings_completion_proof_immutable on public.bookings;
create trigger trg_bookings_completion_proof_immutable
before update on public.bookings
for each row
execute function public.enforce_booking_completion_proof_immutable();
