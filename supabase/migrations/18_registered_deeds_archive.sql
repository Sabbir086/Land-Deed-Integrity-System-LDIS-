-- LDIS: Dedicated archive for completed registrations.
-- Additive migration: preserves the existing Supabase project, registration_register,
-- deed_applications, ref.deeds, and all existing records.
-- Note: this is a dedicated table in the SAME Supabase PostgreSQL database so the
-- registration transaction can safely write both records atomically. It is not a
-- separate Supabase project/database instance.

create table if not exists public.registered_deeds (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.deed_applications(id) on delete restrict,
  registration_record_id uuid not null unique references public.registration_register(id) on delete restrict,
  registration_ref text not null unique,
  registered_by uuid not null references auth.users(id) on delete restrict,
  registered_at timestamptz not null,
  registration_mode text not null default 'DEMO' check (registration_mode = 'DEMO'),
  deed_snapshot jsonb not null,
  archived_at timestamptz not null default now()
);

comment on table public.registered_deeds is
  'Dedicated append-only archive of LDIS completed demo registrations. These records are not official government deeds.';

create index if not exists registered_deeds_registered_at_idx
  on public.registered_deeds (registered_at desc);
create index if not exists registered_deeds_registration_ref_idx
  on public.registered_deeds (registration_ref);

alter table public.registered_deeds enable row level security;
revoke all on public.registered_deeds from public, anon, authenticated;

-- Copy each new registration into the archive in the same transaction that writes
-- registration_register. SECURITY DEFINER allows the trigger to write to the private
-- archive even though browser roles have no direct table privileges.
create or replace function app.archive_registered_deed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.registered_deeds (
    application_id,
    registration_record_id,
    registration_ref,
    registered_by,
    registered_at,
    registration_mode,
    deed_snapshot
  ) values (
    new.application_id,
    new.id,
    new.registration_ref,
    new.registered_by,
    new.registered_at,
    new.mode,
    new.snapshot
  )
  on conflict (application_id) do nothing;

  return new;
end;
$$;

revoke all on function app.archive_registered_deed() from public, anon, authenticated;
drop trigger if exists registration_register_archive_insert on public.registration_register;
create trigger registration_register_archive_insert
after insert on public.registration_register
for each row execute function app.archive_registered_deed();

-- Backfill registrations already present before this migration was installed.
-- ON CONFLICT makes this safe to rerun without duplicating archived registrations.
insert into public.registered_deeds (
  application_id,
  registration_record_id,
  registration_ref,
  registered_by,
  registered_at,
  registration_mode,
  deed_snapshot
)
select
  rr.application_id,
  rr.id,
  rr.registration_ref,
  rr.registered_by,
  rr.registered_at,
  rr.mode,
  rr.snapshot
from public.registration_register rr
on conflict (application_id) do nothing;

-- Keep the archive append-only, matching the existing registration register.
drop trigger if exists registered_deeds_no_mutation on public.registered_deeds;
create trigger registered_deeds_no_mutation
before update or delete on public.registered_deeds
for each row execute function app.reject_immutable_mutation();
