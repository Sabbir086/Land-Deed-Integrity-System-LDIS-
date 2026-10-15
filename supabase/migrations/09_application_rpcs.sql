-- =====================================================================
-- 09_application_rpcs.sql  (Stage 2)  -- functions + grants only, idempotent
-- Public RPCs used by app/api/applications/[action]/route.js.
-- Every function: SECURITY DEFINER, search_path = '', caller must be a signed-in user with
-- role 'user' (app.assert_applicant), ownership re-checked, edit-state re-checked,
-- inputs validated, derived values recomputed by app.recompute (never taken from the client).
-- Error codes: 28000 no session, 42501 not allowed / not yours, 22023 invalid input,
--              AP001 business-rule refusal (message is safe to show), AP002 throttled.
-- EXECUTE: authenticated only.   STATUS: NOT yet applied (no DB in build sandbox).
-- =====================================================================

create or replace function public.app_create_draft() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; n int; a public.deed_applications%rowtype;
begin
  v_uid := app.assert_applicant();
  select count(*) into n from public.deed_applications where applicant_id = v_uid and status in ('draft', 'correction_requested');
  if n >= 10 then raise exception 'You already have 10 open drafts. Finish or withdraw one first.' using errcode = 'AP001'; end if;
  insert into public.deed_applications (applicant_id) values (v_uid) returning * into a;
  insert into public.application_status_history (application_id, from_status, to_status, actor_id, actor_role, note)
  values (a.id, null, 'draft', v_uid, 'user', 'Draft created');
  return jsonb_build_object('ok', true, 'id', a.id, 'application_no', a.application_no);
end $$;

create or replace function public.app_get(p_app uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid;
begin
  v_uid := app.assert_applicant();
  if not exists (select 1 from public.deed_applications where id = p_app and applicant_id = v_uid) then
    raise exception 'application not found' using errcode = '42501';
  end if;
  return jsonb_build_object('ok', true, 'application', app.view(p_app));
end $$;

create or replace function public.app_save_progress(p_app uuid, p_step int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.deed_applications%rowtype;
begin
  a := app.load_editable(p_app);
  if p_step is null or p_step not between 1 and 9 then raise exception 'invalid step' using errcode = '22023'; end if;
  update public.deed_applications set current_step = p_step where id = p_app;
  return jsonb_build_object('ok', true);
end $$;

-- Step 1: donor / donee. NID + DOB are re-verified HERE against ref.nid_persons.
create or replace function public.app_set_party(p_app uuid, p_role text, p_nid text, p_dob date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.deed_applications%rowtype; v jsonb; per jsonb;
begin
  a := app.load_editable(p_app);
  if p_role is null or p_role not in ('donor', 'donee') then raise exception 'invalid role' using errcode = '22023'; end if;
  perform app.rate_check(a.applicant_id, 'nid', 30, 10);
  v := public.verify_nid(p_nid, p_dob);                       -- raises 22023 on malformed input
  if not coalesce((v ->> 'found')::boolean, false) then
    return jsonb_build_object('ok', false, 'found', false);  -- same answer for unknown NID and wrong DOB
  end if;
  per := v -> 'person';
  if exists (select 1 from public.application_parties x where x.application_id = p_app and x.role <> p_role and x.person_id = (per ->> 'id')::uuid) then
    raise exception 'Donor and donee cannot be the same person.' using errcode = 'AP001';
  end if;
  insert into public.application_parties (application_id, role, person_id, nid_masked, name_bn, father_name, mother_name, dob, gender, address, occupation, attestation_count)
  values (p_app, p_role, (per ->> 'id')::uuid, per ->> 'nid_masked', per ->> 'name_bn', per ->> 'father_name', per ->> 'mother_name',
          (per ->> 'dob')::date, per ->> 'gender', per ->> 'address', per ->> 'occupation', jsonb_array_length(v -> 'attestations'))
  on conflict (application_id, role) do update set
    person_id = excluded.person_id, nid_masked = excluded.nid_masked, name_bn = excluded.name_bn, father_name = excluded.father_name,
    mother_name = excluded.mother_name, dob = excluded.dob, gender = excluded.gender, address = excluded.address,
    occupation = excluded.occupation, attestation_count = excluded.attestation_count, verified_at = now();
  perform app.recompute(p_app);
  return jsonb_build_object('ok', true, 'found', true, 'attestations', v -> 'attestations', 'application', app.view(p_app));
end $$;

-- Step 2: location + khatian. Changing the khatian clears ownership and plots (they belong to the old record).
create or replace function public.app_set_land(p_app uuid, p_location_id uuid, p_khatian_type text, p_khatian_no text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.deed_applications%rowtype; v jsonb; kh jsonb; changed boolean; ap public.application_appointments%rowtype;
begin
  a := app.load_editable(p_app);
  v := public.verify_khatian(p_location_id, p_khatian_type, p_khatian_no);   -- raises 22023 on malformed input
  if not coalesce((v ->> 'found')::boolean, false) then
    return jsonb_build_object('ok', false, 'found', false);
  end if;
  kh := v -> 'khatian';
  changed := a.khatian_id is distinct from (kh ->> 'id')::uuid;
  update public.deed_applications set
    location_id = (kh ->> 'location_id')::uuid, khatian_id = (kh ->> 'id')::uuid, khatian_type = kh ->> 'khatian_type', khatian_no = kh ->> 'khatian_no',
    division = kh ->> 'division', district = kh ->> 'district', upazila = kh ->> 'upazila', mouza = kh ->> 'mouza',
    office_district = kh ->> 'district', office_upazila = kh ->> 'upazila'
   where id = p_app;
  if changed then
    delete from public.application_plots where application_id = p_app;
    delete from public.application_ownership where application_id = p_app;
    select * into ap from public.application_appointments where application_id = p_app and status in ('booked', 'confirmed');
    if found and (ap.office_district <> kh ->> 'district' or ap.office_upazila <> kh ->> 'upazila') then
      update public.application_appointments set status = 'cancelled' where id = ap.id;
      insert into public.application_appointment_events (appointment_id, application_id, event, detail, actor_id)
      values (ap.id, p_app, 'cancelled', 'Land location changed; book again for the new office', a.applicant_id);
    end if;
  end if;
  perform app.recompute(p_app);
  return jsonb_build_object('ok', true, 'found', true, 'application', app.view(p_app));
end $$;

-- Step 3: ownership basis. Stores INPUTS only; the outcome is derived by app.recompute.
create or replace function public.app_set_ownership(p_app uuid, p_route text, p_owner_id uuid, p_cert_no text, p_deed_no text, p_deed_date date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.deed_applications%rowtype; v_cert text; v_deed text;
begin
  a := app.load_editable(p_app);
  if a.khatian_id is null then raise exception 'Select the khatian first.' using errcode = 'AP001'; end if;
  if p_route is null or p_route not in ('record_owner', 'warish', 'baya_deed') then raise exception 'invalid route' using errcode = '22023'; end if;
  if p_route in ('record_owner', 'warish') then
    if p_owner_id is null or not exists (select 1 from ref.khatian_owners o where o.id = p_owner_id and o.khatian_id = a.khatian_id) then
      raise exception 'Select an owner listed on this khatian.' using errcode = 'AP001';
    end if;
  end if;
  if p_route = 'warish' then
    v_cert := ref.bn2en(p_cert_no);
    if v_cert is null or length(v_cert) not between 1 and 60 then raise exception 'invalid certificate number' using errcode = '22023'; end if;
  end if;
  if p_route = 'baya_deed' then
    v_deed := ref.bn2en(p_deed_no);
    if p_deed_date is null or v_deed is null or v_deed !~ '^[0-9]{1,6}(/[0-9]{4})?$' then raise exception 'invalid deed number or date' using errcode = '22023'; end if;
  end if;
  perform app.rate_check(a.applicant_id, 'ownership', 60, 10);
  insert into public.application_ownership (application_id, route, owner_id, warish_cert_no, baya_deed_no, baya_deed_date)
  values (p_app, p_route, case when p_route in ('record_owner', 'warish') then p_owner_id end,
          case when p_route = 'warish' then v_cert end, case when p_route = 'baya_deed' then v_deed end, case when p_route = 'baya_deed' then p_deed_date end)
  on conflict (application_id) do update set
    route = excluded.route, owner_id = excluded.owner_id, warish_cert_no = excluded.warish_cert_no,
    baya_deed_no = excluded.baya_deed_no, baya_deed_date = excluded.baya_deed_date,
    name_score = null, father_score = null, identity_outcome = null, heir_relation = null, heir_share = null,
    baya_deed_id = null, baya_area = null, status = 'provisional', checks = '{}'::jsonb;
  perform app.recompute(p_app);
  return jsonb_build_object('ok', true, 'application', app.view(p_app));
end $$;

-- Step 4: dag selection + area. p_plots = [{dag_id, area_sold?}] (1..10). Existing land_class is preserved.
create or replace function public.app_set_plots(p_app uuid, p_plots jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.deed_applications%rowtype; el jsonb; did uuid; ar numeric; ids uuid[] := '{}';
begin
  a := app.load_editable(p_app);
  if a.khatian_id is null then raise exception 'Select the khatian first.' using errcode = 'AP001'; end if;
  if p_plots is null or jsonb_typeof(p_plots) <> 'array' or jsonb_array_length(p_plots) not between 1 and 10 then
    raise exception 'select between 1 and 10 dags' using errcode = '22023';
  end if;
  for el in select * from jsonb_array_elements(p_plots) loop
    if jsonb_typeof(el) <> 'object' or coalesce(el ->> 'dag_id', '') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
      raise exception 'invalid dag' using errcode = '22023';
    end if;
    did := (el ->> 'dag_id')::uuid;
    if did = any (ids) then raise exception 'duplicate dag' using errcode = '22023'; end if;
    if not exists (select 1 from ref.khatian_dags d where d.id = did and d.khatian_id = a.khatian_id) then
      raise exception 'dag does not belong to this khatian' using errcode = '22023';
    end if;
    ar := null;
    if coalesce(el ->> 'area_sold', '') <> '' then
      if (el ->> 'area_sold') !~ '^[0-9]{1,7}(\.[0-9]{1,4})?$' then raise exception 'invalid area' using errcode = '22023'; end if;
      ar := (el ->> 'area_sold')::numeric;
      if ar <= 0 then raise exception 'area must be positive' using errcode = '22023'; end if;
    end if;
    insert into public.application_plots (application_id, dag_id, area_sold) values (p_app, did, ar)
    on conflict (application_id, dag_id) do update set area_sold = excluded.area_sold;
    ids := ids || did;
  end loop;
  delete from public.application_plots where application_id = p_app and dag_id <> all (ids);
  perform app.recompute(p_app);
  return jsonb_build_object('ok', true, 'application', app.view(p_app));
end $$;

-- Step 5: land class per dag + proposed sale price. Fees are then recalculated from public.fee_config.
create or replace function public.app_set_details(p_app uuid, p_details jsonb, p_price numeric) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.deed_applications%rowtype; el jsonb; did uuid; cls text; rec text;
begin
  a := app.load_editable(p_app);
  if p_details is not null then
    if jsonb_typeof(p_details) <> 'array' or jsonb_array_length(p_details) > 10 then raise exception 'invalid details' using errcode = '22023'; end if;
    for el in select * from jsonb_array_elements(p_details) loop
      if coalesce(el ->> 'dag_id', '') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then raise exception 'invalid dag' using errcode = '22023'; end if;
      did := (el ->> 'dag_id')::uuid;
      cls := nullif(btrim(el ->> 'land_class'), '');
      select pl.recorded_land_class into rec from public.application_plots pl where pl.application_id = p_app and pl.dag_id = did;
      if not found then raise exception 'dag is not part of this application' using errcode = '22023'; end if;
      if cls is not null and cls <> all (array['নাল', 'বাড়ি', 'ভিটা', 'মাটিয়াল', 'পুকুর']) and cls is distinct from rec then
        raise exception 'unknown land class' using errcode = '22023';
      end if;
      update public.application_plots set land_class = cls where application_id = p_app and dag_id = did;
    end loop;
  end if;
  if p_price is not null then
    if p_price <= 0 or p_price > 1000000000000 then raise exception 'invalid price' using errcode = '22023'; end if;
    update public.deed_applications set sale_price = round(p_price, 2) where id = p_app;
  end if;
  perform app.recompute(p_app);
  return jsonb_build_object('ok', true, 'application', app.view(p_app));
end $$;

-- Step 6: one challan per fee type. Amount due is taken from the server-computed fee items.
create or replace function public.app_verify_challan(p_app uuid, p_type text, p_challan_no text, p_amount numeric) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.deed_applications%rowtype; n text; due numeric; rc ref.echallans%rowtype; reasons jsonb := '[]'::jsonb;
begin
  a := app.load_editable(p_app);
  n := ref.bn2en(p_challan_no);
  if p_type is null or p_type not in ('stamp', 'registration', 'source_tax', 'other') or n is null or n !~ '^[A-Za-z0-9-]{3,40}$'
     or p_amount is null or p_amount <= 0 or p_amount > 1000000000000 then
    raise exception 'invalid input' using errcode = '22023';
  end if;
  perform app.rate_check(a.applicant_id, 'challan', 20, 10);
  select coalesce(sum(amount), 0) into due from public.application_fee_items where application_id = p_app and challan_type = p_type;
  if due <= 0 then raise exception 'No fee of this type is due for this application.' using errcode = 'AP001'; end if;
  if p_amount <> due then reasons := reasons || to_jsonb('AMOUNT_NOT_DUE'::text); end if;
  select * into rc from ref.echallans x where x.challan_no_norm = n;
  if not found then
    reasons := reasons || to_jsonb('NOT_FOUND'::text);
  else
    if rc.amount <> p_amount then reasons := reasons || to_jsonb('AMOUNT_MISMATCH'::text); end if;
    if rc.fee_type <> p_type then reasons := reasons || to_jsonb('FEE_TYPE_MISMATCH'::text); end if;
    if rc.verify_status <> 'verified' then reasons := reasons || to_jsonb('RECORD_UNVERIFIED'::text); end if;
    if rc.used_in_application_no is not null and rc.used_in_application_no <> a.application_no then reasons := reasons || to_jsonb('ALREADY_USED'::text); end if;
  end if;
  if exists (select 1 from public.application_challans c where c.challan_no_norm = n and c.application_id <> p_app) and not reasons ? 'ALREADY_USED' then
    reasons := reasons || to_jsonb('ALREADY_USED'::text);
  end if;
  if jsonb_array_length(reasons) = 0 then
    delete from public.application_challans where application_id = p_app and challan_type = p_type;
    begin
      insert into public.application_challans (application_id, challan_type, challan_no, challan_no_norm, amount, paid_on)
      values (p_app, p_type, btrim(p_challan_no), n, p_amount, rc.paid_on);
    exception when unique_violation then
      reasons := reasons || to_jsonb('ALREADY_USED'::text);        -- lost a race with another application
    end;
  end if;
  if jsonb_array_length(reasons) = 0 then perform app.recompute(p_app); end if;
  return jsonb_build_object('ok', jsonb_array_length(reasons) = 0, 'reasons', reasons, 'application', app.view(p_app));
end $$;

create or replace function public.app_release_challan(p_app uuid, p_type text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.deed_applications%rowtype;
begin
  a := app.load_editable(p_app);
  delete from public.application_challans where application_id = p_app and challan_type = p_type;
  perform app.recompute(p_app);
  return jsonb_build_object('ok', true, 'application', app.view(p_app));
end $$;

-- ---------------- appointments (booking only; NOT biometric completion) -------------
create or replace function public.app_appointment_availability(p_app uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.deed_applications%rowtype; r public.appointment_rules%rowtype; days jsonb; v_today date := app.today_bd();
begin
  a := app.load_owned(p_app);
  if a.office_upazila is null then raise exception 'Select the land location first; the office is derived from it.' using errcode = 'AP001'; end if;
  if not exists (select 1 from public.profiles p where p.role = 'sub_registrar' and p.district = a.office_district and p.upazila = a.office_upazila) then
    raise exception 'No sub-registrar office is configured for this upazila yet.' using errcode = 'AP001';
  end if;
  select * into r from public.appointment_rules;
  select coalesce(jsonb_agg(jsonb_build_object('date', d.dt, 'slots', (
            select jsonb_agg(jsonb_build_object('slot', s.slot, 'free', greatest(r.capacity_per_slot - (
                     select count(*) from public.application_appointments x
                      where x.office_district = a.office_district and x.office_upazila = a.office_upazila and x.appt_date = d.dt
                        and x.slot = s.slot and x.status in ('booked', 'confirmed') and x.application_id <> p_app), 0)) order by s.slot)
              from unnest(r.slots) as s(slot))) order by d.dt), '[]'::jsonb)
    into days
    from (select (v_today + r.min_lead_days + g.n) as dt from generate_series(0, r.max_advance_days - r.min_lead_days) as g(n)) d
   where extract(dow from d.dt)::int <> all (r.weekend_dow)
     and not exists (select 1 from public.public_holidays h where h.holiday_date = d.dt);
  return jsonb_build_object('ok', true, 'office', jsonb_build_object('district', a.office_district, 'upazila', a.office_upazila),
    'rules', jsonb_build_object('is_demo', r.is_demo, 'note', r.note, 'capacity_per_slot', r.capacity_per_slot, 'min_lead_days', r.min_lead_days),
    'holidays_configured', exists (select 1 from public.public_holidays), 'days', days);
end $$;

create or replace function public.app_book_appointment(p_app uuid, p_date date, p_slot text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.deed_applications%rowtype; r public.appointment_rules%rowtype; v_today date := app.today_bd(); cnt int;
        old public.application_appointments%rowtype; new_id uuid;
begin
  a := app.load_owned(p_app);
  if a.status not in ('draft', 'correction_requested', 'submitted', 'discrepancy_review') then
    raise exception 'Appointments can no longer be changed for this application.' using errcode = 'AP001';
  end if;
  if a.office_upazila is null then raise exception 'Select the land location first.' using errcode = 'AP001'; end if;
  if p_date is null or p_slot is null then raise exception 'invalid input' using errcode = '22023'; end if;
  if not exists (select 1 from public.profiles p where p.role = 'sub_registrar' and p.district = a.office_district and p.upazila = a.office_upazila) then
    raise exception 'No sub-registrar office is configured for this upazila yet.' using errcode = 'AP001';
  end if;
  select * into r from public.appointment_rules;
  if p_date < v_today + r.min_lead_days or p_date > v_today + r.max_advance_days then raise exception 'This date is outside the booking window.' using errcode = 'AP001'; end if;
  if extract(dow from p_date)::int = any (r.weekend_dow) then raise exception 'This is not a working day.' using errcode = 'AP001'; end if;
  if exists (select 1 from public.public_holidays h where h.holiday_date = p_date) then raise exception 'This date is a public holiday.' using errcode = 'AP001'; end if;
  if p_slot <> all (r.slots) then raise exception 'invalid time slot' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext('appt:' || a.office_district || '/' || a.office_upazila || '/' || p_date::text));
  select count(*) into cnt from public.application_appointments x
   where x.office_district = a.office_district and x.office_upazila = a.office_upazila and x.appt_date = p_date and x.slot = p_slot
     and x.status in ('booked', 'confirmed') and x.application_id <> p_app;
  if cnt >= r.capacity_per_slot then raise exception 'This time slot is full. Choose another.' using errcode = 'AP001'; end if;
  select * into old from public.application_appointments where application_id = p_app and status in ('booked', 'confirmed');
  if found then
    if old.status = 'confirmed' then raise exception 'This appointment was confirmed by the office; contact the office to change it.' using errcode = 'AP001'; end if;
    if old.appt_date < v_today + r.min_lead_days then raise exception 'It is too late to reschedule this appointment.' using errcode = 'AP001'; end if;
    update public.application_appointments set status = 'rescheduled' where id = old.id;
    insert into public.application_appointment_events (appointment_id, application_id, event, detail, actor_id) values (old.id, p_app, 'rescheduled', 'Replaced by a new booking', a.applicant_id);
  end if;
  insert into public.application_appointments (application_id, office_district, office_upazila, appt_date, slot)
  values (p_app, a.office_district, a.office_upazila, p_date, p_slot) returning id into new_id;
  insert into public.application_appointment_events (appointment_id, application_id, event, detail, actor_id)
  values (new_id, p_app, 'booked', p_date::text || ' ' || p_slot, a.applicant_id);
  perform app.notify(a.applicant_id, p_app, 'appointment_booked', 'বায়োমেট্রিকের তারিখ বুক হয়েছে: ' || p_date::text, 'Biometric visit booked for ' || p_date::text || ' ' || p_slot);
  if a.status in ('draft', 'correction_requested') then perform app.recompute(p_app); end if;
  return jsonb_build_object('ok', true, 'application', app.view(p_app));
end $$;

create or replace function public.app_cancel_appointment(p_app uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.deed_applications%rowtype; ap public.application_appointments%rowtype;
begin
  a := app.load_owned(p_app);
  select * into ap from public.application_appointments where application_id = p_app and status in ('booked', 'confirmed');
  if not found then raise exception 'There is no active appointment.' using errcode = 'AP001'; end if;
  if ap.status = 'confirmed' then raise exception 'This appointment was confirmed by the office; contact the office to cancel it.' using errcode = 'AP001'; end if;
  if ap.appt_date <= app.today_bd() then raise exception 'It is too late to cancel this appointment.' using errcode = 'AP001'; end if;
  update public.application_appointments set status = 'cancelled' where id = ap.id;
  insert into public.application_appointment_events (appointment_id, application_id, event, detail, actor_id) values (ap.id, p_app, 'cancelled', 'Cancelled by applicant', a.applicant_id);
  perform app.notify(a.applicant_id, p_app, 'appointment_cancelled', 'অ্যাপয়েন্টমেন্ট বাতিল হয়েছে', 'Appointment cancelled');
  if a.status in ('draft', 'correction_requested') then perform app.recompute(p_app); end if;
  return jsonb_build_object('ok', true, 'application', app.view(p_app));
end $$;

-- ---------------- supporting documents (metadata; file lives in Storage) -----------
create or replace function public.app_register_document(p_app uuid, p_type text, p_path text, p_name text, p_mime text, p_size int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.deed_applications%rowtype; n int;
begin
  a := app.load_editable(p_app);
  if p_type is null or p_type not in ('nid_copy', 'porcha_copy', 'warish_certificate', 'previous_deed', 'attestation', 'other')
     or p_mime is null or p_mime not in ('application/pdf', 'image/jpeg', 'image/png')
     or p_size is null or p_size not between 1 and 5242880
     or p_name is null or length(btrim(p_name)) not between 1 and 200
     or p_path is null or p_path not like (a.applicant_id::text || '/' || p_app::text || '/%') or position('..' in p_path) > 0 or length(p_path) > 400 then
    raise exception 'invalid document' using errcode = '22023';
  end if;
  select count(*) into n from public.application_documents where application_id = p_app;
  if n >= 10 then raise exception 'At most 10 documents per application.' using errcode = 'AP001'; end if;
  insert into public.application_documents (application_id, doc_type, storage_path, file_name, mime_type, size_bytes)
  values (p_app, p_type, p_path, btrim(p_name), p_mime, p_size);
  perform app.recompute(p_app);
  return jsonb_build_object('ok', true, 'application', app.view(p_app));
end $$;

create or replace function public.app_delete_document(p_app uuid, p_doc uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.deed_applications%rowtype; v_path text;
begin
  a := app.load_editable(p_app);
  delete from public.application_documents where id = p_doc and application_id = p_app returning storage_path into v_path;
  if v_path is null then raise exception 'document not found' using errcode = '22023'; end if;
  perform app.recompute(p_app);
  return jsonb_build_object('ok', true, 'storage_path', v_path, 'application', app.view(p_app));
end $$;

-- ---------------- final submission / resubmission / withdrawal -----------------------
create or replace function public.app_submit(p_app uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.deed_applications%rowtype; res jsonb; hold boolean; v_new text; resub boolean;
begin
  a := app.load_editable(p_app);
  if p_accept is distinct from true then raise exception 'You must accept the declaration to submit.' using errcode = 'AP001'; end if;
  res := app.recompute(p_app);                                    -- full server-side re-verification
  if jsonb_array_length(res -> 'blockers') > 0 then
    return jsonb_build_object('ok', false, 'reason', 'blockers', 'blockers', res -> 'blockers', 'application', app.view(p_app));
  end if;
  hold := exists (select 1 from jsonb_array_elements(res -> 'flags') f where f ->> 'level' = 'high');
  v_new := case when hold then 'discrepancy_review' else 'submitted' end;
  resub := a.status = 'correction_requested';
  perform app.change_status(p_app, v_new, a.applicant_id, 'user',
    case when resub then 'Resubmitted after correction request' else 'Final submission' end || case when hold then ' (held: high-risk flags)' else '' end);
  update public.deed_applications set declaration_accepted_at = now(), submitted_at = coalesce(submitted_at, now()), last_submitted_at = now(),
         resubmission_count = resubmission_count + case when resub then 1 else 0 end where id = p_app;
  if resub then update public.application_corrections set resolved_at = now() where application_id = p_app and resolved_at is null; end if;
  perform app.notify(a.applicant_id, p_app, 'status_changed',
    case when hold then 'আবেদন জমা হয়েছে; অসংগতি যাচাইয়ের জন্য আটকে রাখা হয়েছে' else 'আবেদন জমা হয়েছে; পর্যালোচনার অপেক্ষায়' end,
    case when hold then 'Application submitted; held for discrepancy review' else 'Application submitted; awaiting review' end);
  return jsonb_build_object('ok', true, 'status', v_new, 'application', app.view(p_app));
end $$;

create or replace function public.app_withdraw(p_app uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.deed_applications%rowtype; ap public.application_appointments%rowtype;
begin
  a := app.load_owned(p_app);
  perform app.change_status(p_app, 'withdrawn', a.applicant_id, 'user', 'Withdrawn by applicant');   -- rules table decides what is allowed
  select * into ap from public.application_appointments where application_id = p_app and status = 'booked';
  if found then
    update public.application_appointments set status = 'cancelled' where id = ap.id;
    insert into public.application_appointment_events (appointment_id, application_id, event, detail, actor_id) values (ap.id, p_app, 'cancelled', 'Application withdrawn', a.applicant_id);
  end if;
  perform app.notify(a.applicant_id, p_app, 'status_changed', 'আবেদন প্রত্যাহার করা হয়েছে', 'Application withdrawn');
  return jsonb_build_object('ok', true, 'application', app.view(p_app));
end $$;

create or replace function public.notifications_mark_read(p_ids uuid[] default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_role text; n int;
begin
  v_role := ref.assert_app_user();
  update public.user_notifications set read_at = now()
   where user_id = (select auth.uid()) and read_at is null and (p_ids is null or id = any (p_ids));
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'updated', n);
end $$;

-- ---------------- grants: authenticated only -----------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'app_create_draft()', 'app_get(uuid)', 'app_save_progress(uuid,int)', 'app_set_party(uuid,text,text,date)',
    'app_set_land(uuid,uuid,text,text)', 'app_set_ownership(uuid,text,uuid,text,text,date)', 'app_set_plots(uuid,jsonb)',
    'app_set_details(uuid,jsonb,numeric)', 'app_verify_challan(uuid,text,text,numeric)', 'app_release_challan(uuid,text)',
    'app_appointment_availability(uuid)', 'app_book_appointment(uuid,date,text)', 'app_cancel_appointment(uuid)',
    'app_register_document(uuid,text,text,text,text,int)', 'app_delete_document(uuid,uuid)', 'app_submit(uuid,boolean)',
    'app_withdraw(uuid)', 'notifications_mark_read(uuid[])']
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
