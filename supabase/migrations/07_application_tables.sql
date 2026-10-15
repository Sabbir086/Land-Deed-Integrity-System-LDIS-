-- =====================================================================
-- 07_application_tables.sql  (Stage 2)  -- ADDITIVE ONLY
-- Application-layer data model. Does NOT touch ref.* or any existing table.
--
-- Security model
--  * RLS is enabled on every table here.
--  * `authenticated` gets SELECT on own rows only. There is NO insert/update/delete
--    grant or policy for browsers: all writes go through SECURITY DEFINER RPCs
--    (08_application_logic.sql / 09_application_rpcs.sql) that re-check the caller.
--  * Roles are read from public.profiles (never from client input).
--  * Sub-registrar read policies are intentionally NOT created here (Stage 3 decision:
--    own upazila vs all). Until then staff cannot read applications through the API.
--
-- STATUS: written in a sandbox without a database. NOT yet applied. Run 07, 08, 09 in order.
-- =====================================================================

create schema if not exists app;                       -- internal helpers, not an exposed API schema
revoke all on schema app from public, anon, authenticated;

create sequence if not exists app.application_no_seq start 1;
revoke all on sequence app.application_no_seq from public, anon, authenticated;

create or replace function app.next_application_no() returns text
language sql volatile set search_path = '' as $$
  select 'DA-' || to_char(now() at time zone 'Asia/Dhaka', 'YYYY') || '-' || lpad(nextval('app.application_no_seq')::text, 6, '0')
$$;
revoke all on function app.next_application_no() from public, anon, authenticated;

-- ---------- configuration tables (readable by signed-in users) ---------------
create table if not exists public.fee_config (
  fee_code     text primary key,
  name_bn      text not null,
  name_en      text not null,
  rate_percent numeric(7,4) not null default 0 check (rate_percent >= 0),
  fixed_amount numeric(14,2) not null default 0 check (fixed_amount >= 0),
  min_amount   numeric(14,2) not null default 0 check (min_amount >= 0),
  basis        text not null default 'sale_price' check (basis in ('sale_price')),
  challan_type text not null check (challan_type in ('stamp','registration','source_tax','other')),
  sort_order   smallint not null default 100,
  is_demo      boolean not null default true,
  active       boolean not null default true,
  note         text,
  updated_at   timestamptz not null default now()
);

-- DEMO values only. The 1.5% / 1% / 1% figures are the *sample* percentages printed in the project
-- document (explicitly "not real government rates"). e-fee / n-fee / nn-fee exist as INACTIVE rows
-- because no rate was supplied. Replace with official values before any real use.
insert into public.fee_config (fee_code, name_bn, name_en, rate_percent, challan_type, sort_order, is_demo, active, note) values
 ('stamp',        'স্ট্যাম্প ফি',   'Stamp fee',        1.5, 'stamp',        10, true, true,  'DEMO rate from the project document sample. Confirm official rate.'),
 ('registration', 'রেজিস্ট্রেশন ফি', 'Registration fee', 1.0, 'registration', 20, true, true,  'DEMO rate from the project document sample. Confirm official rate.'),
 ('source_tax',   'উৎসে কর',        'Source tax',       1.0, 'source_tax',   30, true, true,  'DEMO rate from the project document sample. Confirm official rate.')
on conflict (fee_code) do nothing;
insert into public.fee_config (fee_code, name_bn, name_en, rate_percent, challan_type, sort_order, is_demo, active, note) values
 ('e_fee',  'ই-ফি',    'E-fee',  0, 'other', 40, true, false, 'No official rate supplied. Inactive.'),
 ('n_fee',  'এন-ফি',   'N-fee',  0, 'other', 50, true, false, 'No official rate supplied. Inactive.'),
 ('nn_fee', 'এনএন-ফি', 'NN-fee', 0, 'other', 60, true, false, 'No official rate supplied. Inactive.')
on conflict (fee_code) do nothing;

-- single-row rules for appointment availability (DEMO defaults, configurable)
create table if not exists public.appointment_rules (
  id               boolean primary key default true check (id),
  weekend_dow      smallint[] not null default '{5,6}',            -- 0=Sun .. 6=Sat  (Fri, Sat)
  slots            text[] not null default '{10:00,11:00,12:00,14:00,15:00}',
  capacity_per_slot smallint not null default 5 check (capacity_per_slot > 0),
  min_lead_days    smallint not null default 2 check (min_lead_days >= 0),
  max_advance_days smallint not null default 30 check (max_advance_days >= 1),
  is_demo          boolean not null default true,
  note             text default 'DEMO availability rules. Confirm office working days, slots and capacity.'
);
insert into public.appointment_rules (id) values (true) on conflict (id) do nothing;

create table if not exists public.public_holidays (
  holiday_date date primary key,
  name         text not null,
  source       text default 'manual'
);   -- intentionally EMPTY: the official holiday source is an open decision (PROJECT_SPEC §6)

-- documented state machine. `active=false` rows are Stage 3 transitions prepared but not usable yet.
create table if not exists public.application_status_rules (
  from_status text not null,
  to_status   text not null,
  actor_role  text not null check (actor_role in ('user','sub_registrar','admin','system')),
  stage       smallint not null default 2,
  active      boolean not null default true,
  note        text,
  primary key (from_status, to_status, actor_role)
);
insert into public.application_status_rules (from_status, to_status, actor_role, stage, active, note) values
 ('draft','submitted','user',2,true,'Final submit, no hold flags'),
 ('draft','discrepancy_review','user',2,true,'Final submit, one or more HIGH flags => held for review'),
 ('draft','withdrawn','user',2,true,null),
 ('correction_requested','submitted','user',2,true,'Resubmission'),
 ('correction_requested','discrepancy_review','user',2,true,'Resubmission with HIGH flags'),
 ('correction_requested','withdrawn','user',2,true,null),
 ('submitted','withdrawn','user',2,true,'Only before review starts'),
 ('discrepancy_review','withdrawn','user',2,true,null),
 ('submitted','under_review','sub_registrar',3,false,'Stage 3'),
 ('discrepancy_review','under_review','sub_registrar',3,false,'Stage 3'),
 ('submitted','correction_requested','sub_registrar',3,false,'Stage 3'),
 ('under_review','correction_requested','sub_registrar',3,false,'Stage 3 send-back'),
 ('discrepancy_review','correction_requested','sub_registrar',3,false,'Stage 3 send-back'),
 ('under_review','registered','sub_registrar',3,false,'Stage 3 atomic registration'),
 ('under_review','rejected','sub_registrar',3,false,'Stage 3')
on conflict do nothing;

-- ---------- core application ---------------------------------------------------
create table if not exists public.deed_applications (
  id                 uuid primary key default gen_random_uuid(),
  application_no     text not null unique default app.next_application_no(),
  applicant_id       uuid not null references auth.users(id) on delete restrict,
  status             text not null default 'draft' check (status in
                       ('draft','submitted','under_review','discrepancy_review','correction_requested','registered','rejected','withdrawn')),
  current_step       smallint not null default 1 check (current_step between 1 and 9),
  location_id        uuid,
  khatian_id         uuid,
  khatian_type       text,
  khatian_no         text,
  division           text, district text, upazila text, mouza text,
  office_district    text,                       -- routing key for the sub-registrar office (Stage 3)
  office_upazila     text,
  sale_price         numeric(14,2) check (sale_price is null or sale_price > 0),
  fee_total          numeric(14,2) not null default 0,
  flags              jsonb not null default '[]'::jsonb,     -- explainable indicators (server-computed)
  blockers           jsonb not null default '[]'::jsonb,     -- reasons submission is not yet possible
  flags_evaluated_at timestamptz,
  biometric_status   text not null default 'not_started' check (biometric_status in ('not_started','completed','failed')),
                     -- Stage 2 NEVER sets this. A booked appointment is not biometric completion.
  declaration_accepted_at timestamptz,
  submitted_at       timestamptz,
  last_submitted_at  timestamptz,
  resubmission_count smallint not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists deed_applications_applicant_idx on public.deed_applications (applicant_id, updated_at desc);
create index if not exists deed_applications_office_idx on public.deed_applications (office_district, office_upazila, status);

create table if not exists public.application_parties (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.deed_applications(id) on delete restrict,
  role           text not null check (role in ('donor','donee')),
  person_id      uuid not null,                 -- ref.nid_persons.id (no FK: ref stays private)
  nid_masked     text not null,                 -- the full NID number is NOT stored
  name_bn        text not null, father_name text, mother_name text,
  dob            date not null, gender text, address text, occupation text,
  attestation_count smallint not null default 0,
  verified_at    timestamptz not null default now(),
  unique (application_id, role)
);

create table if not exists public.application_ownership (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.deed_applications(id) on delete restrict,
  route          text not null check (route in ('record_owner','warish','baya_deed')),
  -- user inputs
  owner_id       uuid,                          -- ref.khatian_owners.id (record_owner / warish deceased owner)
  warish_cert_no text,
  baya_deed_no   text,
  baya_deed_date date,
  -- server-derived (recomputed on every save and at submit)
  owner_name text, owner_father_name text, owner_share numeric(4,3),
  name_score numeric, father_score numeric,
  identity_outcome text check (identity_outcome in ('meets_provisional_threshold','discrepancy_review','insufficient_data')),
  heir_relation text, heir_share numeric(4,3),
  baya_deed_id uuid, baya_area numeric(10,4),
  status text not null default 'provisional' check (status in ('provisional','review','blocked')),
                 -- 'provisional' = no discrepancy found; NEVER means ownership is established.
  checks jsonb not null default '{}'::jsonb,
  verified_at timestamptz
);

create table if not exists public.application_plots (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.deed_applications(id) on delete restrict,
  dag_id         uuid not null,                 -- ref.khatian_dags.id
  dag_no text, dag_area numeric(10,4), recorded_land_class text,
  land_class     text,                          -- chosen by the applicant
  area_sold      numeric(10,4) check (area_sold is null or area_sold > 0),
  entitled numeric(10,4), already_sold numeric(10,4), remaining numeric(10,4), after_sale numeric(10,4),
  all_sold_total numeric(10,4), other_deeds_count smallint not null default 0,
  khas_matches   jsonb not null default '[]'::jsonb,
  history        jsonb not null default '{}'::jsonb,   -- {donor_sales[], other_deeds[], purchases[]}
  assumptions    text[] not null default '{}',
  created_at     timestamptz not null default now(),
  unique (application_id, dag_id)
);

create table if not exists public.application_fee_items (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.deed_applications(id) on delete restrict,
  fee_code text not null, name_bn text not null, name_en text not null,
  rate_percent numeric(7,4) not null, fixed_amount numeric(14,2) not null, min_amount numeric(14,2) not null,
  basis text not null, base_amount numeric(14,2) not null, amount numeric(14,2) not null,
  challan_type text not null, is_demo boolean not null,
  unique (application_id, fee_code)
);

create table if not exists public.application_challans (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.deed_applications(id) on delete restrict,
  challan_type text not null check (challan_type in ('stamp','registration','source_tax','other')),
  challan_no text not null,
  challan_no_norm text not null,
  amount numeric(14,2) not null check (amount > 0),
  paid_on date,
  verification_basis text not null default 'dummy_reference_record',  -- NOT proof of real payment
  verified_at timestamptz not null default now(),
  unique (challan_no_norm),                     -- duplicate / reuse prevention, race-safe
  unique (application_id, challan_type)
);

create table if not exists public.application_status_history (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.deed_applications(id) on delete restrict,
  from_status text, to_status text not null,
  actor_id uuid, actor_role text, note text,
  created_at timestamptz not null default now()
);
create index if not exists application_status_history_app_idx on public.application_status_history (application_id, id);

create table if not exists public.application_corrections (    -- rows are created by Stage 3 (sub-registrar send-back)
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.deed_applications(id) on delete restrict,
  requested_by uuid, message text not null,
  steps smallint[] not null default '{}',       -- wizard steps that need attention
  requested_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.deed_applications(id) on delete restrict,
  doc_type text not null check (doc_type in ('nid_copy','porcha_copy','warish_certificate','previous_deed','attestation','other')),
  storage_path text not null unique, file_name text not null, mime_type text not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 5242880),
  created_at timestamptz not null default now()
);

create table if not exists public.application_appointments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.deed_applications(id) on delete restrict,
  office_district text not null, office_upazila text not null,
  appt_date date not null, slot text not null,
  purpose text not null default 'biometric_visit',
  status text not null default 'booked' check (status in ('booked','confirmed','rescheduled','cancelled','missed','completed')),
                 -- 'confirmed','missed','completed' are for Stage 3 (office side). Booking != biometric completion.
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists one_active_appointment_per_app
  on public.application_appointments (application_id) where status in ('booked','confirmed');
create index if not exists appointment_capacity_idx
  on public.application_appointments (office_district, office_upazila, appt_date, slot) where status in ('booked','confirmed');

create table if not exists public.application_appointment_events (
  id bigint generated always as identity primary key,
  appointment_id uuid not null references public.application_appointments(id) on delete restrict,
  application_id uuid not null references public.deed_applications(id) on delete restrict,
  event text not null, detail text, actor_id uuid, created_at timestamptz not null default now()
);

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid references public.deed_applications(id) on delete restrict,
  kind text not null, title_bn text not null, title_en text not null,
  created_at timestamptz not null default now(), read_at timestamptz
);
create index if not exists user_notifications_user_idx on public.user_notifications (user_id, created_at desc);

-- lookup throttle (NID / challan probing). Written only by definer functions.
create table if not exists app.lookup_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null, kind text not null, attempted_at timestamptz not null default now()
);
create index if not exists lookup_attempts_idx on app.lookup_attempts (user_id, kind, attempted_at desc);

-- ---------- append-only guards -------------------------------------------------
create or replace function app.block_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin raise exception 'this table is append-only' using errcode = '42501'; end $$;
revoke all on function app.block_mutation() from public, anon, authenticated;

drop trigger if exists trg_status_history_append_only on public.application_status_history;
create trigger trg_status_history_append_only before update or delete on public.application_status_history
  for each row execute function app.block_mutation();
drop trigger if exists trg_appt_events_append_only on public.application_appointment_events;
create trigger trg_appt_events_append_only before update or delete on public.application_appointment_events
  for each row execute function app.block_mutation();

-- ---------- updated_at ---------------------------------------------------------
drop trigger if exists trg_deed_applications_updated on public.deed_applications;
create trigger trg_deed_applications_updated before update on public.deed_applications for each row execute function ref.set_updated_at();
drop trigger if exists trg_appointments_updated on public.application_appointments;
create trigger trg_appointments_updated before update on public.application_appointments for each row execute function ref.set_updated_at();

-- ---------- RLS + grants ---------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['fee_config','appointment_rules','public_holidays','application_status_rules',
    'deed_applications','application_parties','application_ownership','application_plots','application_fee_items',
    'application_challans','application_status_history','application_corrections','application_documents',
    'application_appointments','application_appointment_events','user_notifications']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;
alter table app.lookup_attempts enable row level security;
revoke all on app.lookup_attempts from public, anon, authenticated;

-- config: any signed-in user may read
drop policy if exists "read fee config" on public.fee_config;
create policy "read fee config" on public.fee_config for select to authenticated using (true);
drop policy if exists "read appointment rules" on public.appointment_rules;
create policy "read appointment rules" on public.appointment_rules for select to authenticated using (true);
drop policy if exists "read holidays" on public.public_holidays;
create policy "read holidays" on public.public_holidays for select to authenticated using (true);
drop policy if exists "read status rules" on public.application_status_rules;
create policy "read status rules" on public.application_status_rules for select to authenticated using (true);

-- applicant sees only their own application and its child rows
drop policy if exists "own applications" on public.deed_applications;
create policy "own applications" on public.deed_applications for select to authenticated
  using (applicant_id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['application_parties','application_ownership','application_plots','application_fee_items',
    'application_challans','application_status_history','application_corrections','application_documents',
    'application_appointments','application_appointment_events']
  loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format($p$create policy "own rows" on public.%I for select to authenticated
      using (exists (select 1 from public.deed_applications a where a.id = application_id and a.applicant_id = (select auth.uid())))$p$, t);
  end loop;
end $$;

drop policy if exists "own notifications" on public.user_notifications;
create policy "own notifications" on public.user_notifications for select to authenticated using (user_id = (select auth.uid()));

-- ---------- private storage bucket for supporting documents -----------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('application-docs', 'application-docs', false, 5242880, array['application/pdf','image/jpeg','image/png'])
on conflict (id) do nothing;

drop policy if exists "app docs insert own folder" on storage.objects;
create policy "app docs insert own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'application-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "app docs read own folder" on storage.objects;
create policy "app docs read own folder" on storage.objects for select to authenticated
  using (bucket_id = 'application-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "app docs delete own folder" on storage.objects;
create policy "app docs delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'application-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- Stage 3 must add a read policy for the responsible sub-registrar.
