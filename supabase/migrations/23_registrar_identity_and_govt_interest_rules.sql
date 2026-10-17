-- LDIS migration 23: registrar evidence rules, government-interest hard stop, and clearer review state.
-- Additive. Does not delete data, users, roles, or alter the existing ref.* table structure.
-- Apply after migrations 06-22. The web UI alone is not the security boundary: these rules run in PostgreSQL.

begin;

-- Keep staff-only evidence out of app.view(), which returns the applicant's own application snapshot.
create table if not exists public.application_identity_evidence (
  application_id uuid primary key references public.deed_applications(id) on delete restrict,
  attestation_verified boolean not null default false,
  attestation_verified_by uuid references auth.users(id) on delete restrict,
  attestation_verified_at timestamptz,
  affidavit_received boolean not null default false,
  affidavit_received_by uuid references auth.users(id) on delete restrict,
  affidavit_received_at timestamptz,
  affidavit_note text,
  updated_at timestamptz not null default now(),
  check ((attestation_verified = false) or (attestation_verified_by is not null and attestation_verified_at is not null)),
  check ((affidavit_received = false) or (affidavit_received_by is not null and affidavit_received_at is not null))
);
alter table public.application_identity_evidence enable row level security;
revoke all on public.application_identity_evidence from public, anon, authenticated;

-- Detect a positive government-interest match from the live reference rows and also honour a
-- computed high-risk flag. Absence of a row is not a legal clearance.
create or replace function app.ldis_has_government_interest(p_app uuid)
returns boolean
language sql stable security definer set search_path = '' as $$
  select
    exists (
      select 1
      from public.deed_applications a
      join ref.khatians k on k.id = a.khatian_id
      join public.application_plots ap on ap.application_id = a.id
      join ref.khatian_dags d on d.id = ap.dag_id and d.khatian_id = k.id
      join ref.khas_govt g
        on g.location_id = a.location_id
       and g.khatian_no_norm = k.khatian_no_norm
       and g.dag_no_norm = d.dag_no_norm
      where a.id = p_app
    )
    or exists (
      select 1
      from public.deed_applications a,
           jsonb_array_elements(coalesce(a.flags, '[]'::jsonb)) as flag(value)
      where a.id = p_app and flag.value->>'code' = 'GOVT_INTEREST_MATCH'
    );
$$;
revoke all on function app.ldis_has_government_interest(uuid) from public, anon, authenticated;

-- Clear identity evidence whenever the selected owner/basis or name comparison changes.
create or replace function app.ldis_reset_evidence_after_ownership_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_app uuid;
begin
  if tg_op = 'DELETE' then v_app := old.application_id; else v_app := new.application_id; end if;
  update public.application_identity_evidence
     set attestation_verified = false,
         attestation_verified_by = null,
         attestation_verified_at = null,
         affidavit_received = false,
         affidavit_received_by = null,
         affidavit_received_at = null,
         affidavit_note = null,
         updated_at = now()
   where application_id = v_app;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
revoke all on function app.ldis_reset_evidence_after_ownership_change() from public, anon, authenticated;
drop trigger if exists ldis_reset_identity_evidence_on_ownership_change on public.application_ownership;
create trigger ldis_reset_identity_evidence_on_ownership_change
after update of route, owner_id, name_score on public.application_ownership
for each row
when (old.route is distinct from new.route or old.owner_id is distinct from new.owner_id or old.name_score is distinct from new.name_score)
execute function app.ldis_reset_evidence_after_ownership_change();

drop trigger if exists ldis_reset_identity_evidence_on_ownership_delete on public.application_ownership;
create trigger ldis_reset_identity_evidence_on_ownership_delete
after delete on public.application_ownership
for each row execute function app.ldis_reset_evidence_after_ownership_change();

create or replace function app.ldis_reset_evidence_after_donor_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.application_identity_evidence
     set attestation_verified = false,
         attestation_verified_by = null,
         attestation_verified_at = null,
         affidavit_received = false,
         affidavit_received_by = null,
         affidavit_received_at = null,
         affidavit_note = null,
         updated_at = now()
   where application_id = new.application_id;
  return new;
end $$;
revoke all on function app.ldis_reset_evidence_after_donor_change() from public, anon, authenticated;
drop trigger if exists ldis_reset_identity_evidence_on_donor_change on public.application_parties;
create trigger ldis_reset_identity_evidence_on_donor_change
after update of person_id on public.application_parties
for each row
when (old.role = 'donor' and new.role = 'donor' and old.person_id is distinct from new.person_id)
execute function app.ldis_reset_evidence_after_donor_change();

-- Registrar decisions are server-authoritative. Government-interest hits permit only rejection.
create or replace function public.staff_decide_application(
  p_app uuid,
  p_decision text,
  p_note text default '',
  p_steps smallint[] default '{}'
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
  v_district text;
  v_upazila text;
  v_approved boolean;
  a public.deed_applications%rowtype;
  v_to text;
  v_name_score numeric;
  v_attestation_verified boolean := false;
  v_affidavit_received boolean := false;
  v_total integer := 0;
  v_correct integer := 0;
begin
  select role, district, upazila, is_approved
    into v_role, v_district, v_upazila, v_approved
    from public.profiles where id = auth.uid();
  if v_approved is distinct from true or v_role not in ('sub_registrar', 'admin') then
    raise exception 'approved staff access required' using errcode = '42501';
  end if;

  select * into a
    from public.deed_applications x
   where x.id = p_app
     and (v_role = 'admin' or (x.office_district = v_district and x.office_upazila = v_upazila))
   for update;
  if not found then raise exception 'application not found' using errcode = '42501'; end if;
  if a.status not in ('submitted', 'under_review', 'discrepancy_review', 'correction_requested') then
    raise exception 'application is not in a reviewable state' using errcode = 'AP001';
  end if;
  if p_decision is null or p_decision not in (
    'start_review', 'request_correction', 'approve', 'reject',
    'confirm_appointment', 'mark_biometric_completed', 'mark_biometric_failed',
    'verify_attestation', 'mark_affidavit_received'
  ) then raise exception 'unsupported decision' using errcode = '22023'; end if;

  if app.ldis_has_government_interest(p_app) and p_decision <> 'reject' then
    raise exception 'Government-interest record found: registration is prohibited. Only Reject is allowed.' using errcode = 'AP001';
  end if;
  if app.ldis_has_government_interest(p_app) and p_decision = 'reject' and length(btrim(coalesce(p_note, ''))) < 5 then
    raise exception 'Record the government-interest reason before rejecting this application.' using errcode = '22023';
  end if;

  if p_decision = 'start_review' then v_to := 'under_review';
  elsif p_decision = 'request_correction' then v_to := 'correction_requested';
  elsif p_decision = 'reject' then v_to := 'rejected';
  else v_to := a.status; end if;

  if p_decision = 'request_correction' and length(btrim(coalesce(p_note, ''))) < 5 then
    raise exception 'Correction request must explain what needs fixing.' using errcode = '22023';
  end if;
  if p_decision in ('approve', 'confirm_appointment', 'mark_biometric_completed', 'mark_biometric_failed', 'verify_attestation', 'mark_affidavit_received') and a.status <> 'under_review' then
    raise exception 'Start review first; this action requires Under review status.' using errcode = 'AP001';
  end if;

  select o.name_score into v_name_score
    from public.application_ownership o where o.application_id = p_app and o.route = 'record_owner';
  select coalesce(e.attestation_verified, false), coalesce(e.affidavit_received, false)
    into v_attestation_verified, v_affidavit_received
    from public.application_identity_evidence e where e.application_id = p_app;
  v_attestation_verified := coalesce(v_attestation_verified, false);
  v_affidavit_received := coalesce(v_affidavit_received, false);

  if p_decision = 'request_correction' then
    insert into public.application_corrections(application_id, requested_by, message, steps)
    values (p_app, auth.uid(), btrim(p_note), coalesce(p_steps, '{}'));

  elsif p_decision = 'confirm_appointment' then
    update public.application_appointments set status = 'confirmed', updated_at = now()
     where application_id = p_app and status in ('booked', 'rescheduled');
    if not found then raise exception 'No bookable appointment found. Book/reschedule first.' using errcode = 'AP001'; end if;

  elsif p_decision = 'mark_biometric_completed' then
    if not exists (select 1 from public.application_appointments where application_id = p_app and status in ('confirmed', 'completed')) then
      raise exception 'Confirm an appointment before recording biometric status.' using errcode = 'AP001';
    end if;
    update public.deed_applications set biometric_status = 'completed' where id = p_app;
    update public.application_appointments set status = 'completed', updated_at = now() where application_id = p_app and status = 'confirmed';

  elsif p_decision = 'mark_biometric_failed' then
    update public.deed_applications set biometric_status = 'failed' where id = p_app;

  elsif p_decision = 'verify_attestation' then
    if v_role <> 'sub_registrar' then raise exception 'Only the assigned Sub-Registrar can verify this attestation.' using errcode = '42501'; end if;
    if v_name_score is null or v_name_score < 0.5 or v_name_score >= 0.9 then
      raise exception 'Attestation verification applies only when the recorded-owner name match is at least 50%% and below 90%%.' using errcode = 'AP001';
    end if;
    if not exists (select 1 from public.application_documents d where d.application_id = p_app and d.doc_type = 'attestation') then
      raise exception 'Applicant must upload an Attestation document before verification.' using errcode = 'AP001';
    end if;
    insert into public.application_identity_evidence(application_id, attestation_verified, attestation_verified_by, attestation_verified_at, updated_at)
    values (p_app, true, auth.uid(), now(), now())
    on conflict (application_id) do update set
      attestation_verified = true, attestation_verified_by = excluded.attestation_verified_by,
      attestation_verified_at = excluded.attestation_verified_at, updated_at = now();

  elsif p_decision = 'mark_affidavit_received' then
    if v_role <> 'sub_registrar' then raise exception 'Only the assigned Sub-Registrar can record receipt of the original Affidavit.' using errcode = '42501'; end if;
    if a.biometric_status is distinct from 'completed' then
      raise exception 'Record biometric completion first; the original Affidavit must be checked and received on biometric day.' using errcode = 'AP001';
    end if;
    if v_name_score is null or v_name_score >= 0.5 then
      raise exception 'Affidavit receipt is required in this workflow only when the recorded-owner name match is below 50%%.' using errcode = 'AP001';
    end if;
    insert into public.application_identity_evidence(application_id, affidavit_received, affidavit_received_by, affidavit_received_at, affidavit_note, updated_at)
    values (p_app, true, auth.uid(), now(), nullif(left(btrim(coalesce(p_note, '')), 1000), ''), now())
    on conflict (application_id) do update set
      affidavit_received = true, affidavit_received_by = excluded.affidavit_received_by,
      affidavit_received_at = excluded.affidavit_received_at, affidavit_note = excluded.affidavit_note, updated_at = now();

  elsif p_decision = 'approve' then
    if a.status <> 'under_review' then raise exception 'Application must be Under review before approval.' using errcode = 'AP001'; end if;
    if jsonb_array_length(coalesce(a.blockers, '[]'::jsonb)) > 0 then
      raise exception 'Application has unresolved system blockers.' using errcode = 'AP001';
    end if;
    if a.biometric_status is distinct from 'completed' then raise exception 'Record biometric appointment outcome before approval.' using errcode = 'AP001'; end if;
    select count(*), count(*) filter (where decision = 'correct') into v_total, v_correct
      from public.registrar_review_checklist where application_id = p_app;
    if v_total <> 12 or v_correct <> 12 then
      raise exception 'All 12 Sub-Registrar checklist items must be saved as Correct before approval.' using errcode = 'AP001';
    end if;
    if v_name_score is not null and v_name_score >= 0.5 and v_name_score < 0.9 and not v_attestation_verified then
      raise exception 'Name match is 50%%-89%%: verify the uploaded Attestation before approval.' using errcode = 'AP001';
    end if;
    if v_name_score is not null and v_name_score < 0.5 and not v_affidavit_received then
      raise exception 'Name match is below 50%%: the Sub-Registrar must record receipt of the original Affidavit on biometric day.' using errcode = 'AP001';
    end if;
    if exists (
      select 1 from public.application_challans c
      where c.application_id = p_app and not exists (
        select 1 from ref.echallans e
        where ref.bn2en(e.challan_no) = ref.bn2en(c.challan_no)
          and e.amount = c.amount and e.fee_type = c.challan_type and e.verify_status = 'verified'
          and (e.used_in_application_no is null or e.used_in_application_no = a.application_no)
      )
    ) then raise exception 'One or more challans could not be verified against reference records.' using errcode = 'AP001'; end if;
  end if;

  if v_to <> a.status then
    update public.deed_applications set status = v_to, updated_at = now() where id = p_app;
    insert into public.application_status_history(application_id, from_status, to_status, actor_id, actor_role, note)
    values (p_app, a.status, v_to, auth.uid(), v_role, coalesce(nullif(btrim(p_note), ''), p_decision));
  end if;
  insert into public.audit_logs(actor_id, actor_role, action, application_id, details)
  values (auth.uid(), v_role, 'registrar_decision', p_app,
    jsonb_build_object('decision', p_decision, 'note', left(coalesce(p_note, ''), 1000), 'from_status', a.status, 'to_status', v_to));
  insert into public.user_notifications(user_id, application_id, kind, title_bn, title_en)
  values (a.applicant_id, p_app, 'staff_update', 'আবেদনের অবস্থা হালনাগাদ', 'Application updated');
  return jsonb_build_object('ok', true, 'status', v_to, 'decision', p_decision);
end $$;
revoke all on function public.staff_decide_application(uuid, text, text, smallint[]) from public, anon;
grant execute on function public.staff_decide_application(uuid, text, text, smallint[]) to authenticated;

-- Approval and finalization return understandable data, including the current evidence state.
create or replace function public.staff_application_detail(p_app uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
  v_district text;
  v_upazila text;
  v_approved boolean;
  a public.deed_applications%rowtype;
begin
  select role, district, upazila, is_approved into v_role, v_district, v_upazila, v_approved
    from public.profiles where id = auth.uid();
  if v_approved is distinct from true or v_role not in ('sub_registrar', 'admin') then
    raise exception 'approved staff access required' using errcode = '42501';
  end if;
  select * into a from public.deed_applications x
   where x.id = p_app and (v_role = 'admin' or (x.office_district = v_district and x.office_upazila = v_upazila));
  if not found or a.status in ('draft', 'withdrawn') then raise exception 'application not found' using errcode = '42501'; end if;
  insert into public.audit_logs(actor_id, actor_role, action, application_id, details)
  values (auth.uid(), v_role, 'application_review_opened', p_app, '{}'::jsonb);
  return jsonb_build_object(
    'government_interest', app.ldis_has_government_interest(p_app),
    'application', to_jsonb(a) || jsonb_build_object(
      'affidavit_received', coalesce((select e.affidavit_received from public.application_identity_evidence e where e.application_id = p_app), false),
      'affidavit_received_at', (select e.affidavit_received_at from public.application_identity_evidence e where e.application_id = p_app),
      'affidavit_note', (select e.affidavit_note from public.application_identity_evidence e where e.application_id = p_app)
    ),
    'applicant', (select jsonb_build_object('full_name', p.full_name, 'email', p.email) from public.profiles p where p.id = a.applicant_id),
    'parties', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.application_parties x where x.application_id = p_app),
    'witnesses', (select coalesce(jsonb_agg(to_jsonb(x) - 'application_id' order by x.serial), '[]'::jsonb) from public.application_witnesses x where x.application_id = p_app),
    'ownership', (select to_jsonb(x) || jsonb_build_object(
      'attestation_verified', coalesce((select e.attestation_verified from public.application_identity_evidence e where e.application_id = p_app), false),
      'attestation_verified_at', (select e.attestation_verified_at from public.application_identity_evidence e where e.application_id = p_app)
    ) from public.application_ownership x where x.application_id = p_app),
    'plots', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.application_plots x where x.application_id = p_app),
    'fees', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.application_fee_items x where x.application_id = p_app),
    'challans', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.application_challans x where x.application_id = p_app),
    'documents', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.application_documents x where x.application_id = p_app),
    'appointments', (select coalesce(jsonb_agg(to_jsonb(x) order by x.appt_date desc), '[]'::jsonb) from public.application_appointments x where x.application_id = p_app),
    'corrections', (select coalesce(jsonb_agg(to_jsonb(x) order by x.requested_at desc), '[]'::jsonb) from public.application_corrections x where x.application_id = p_app),
    'history', (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]'::jsonb) from public.application_status_history x where x.application_id = p_app),
    'registrar_approved', exists (
      select 1 from public.audit_logs l where l.application_id = p_app and l.action = 'registrar_decision' and l.details->>'decision' = 'approve'
    ),
    'registrar_decisions', (select coalesce(jsonb_agg(jsonb_build_object('decision', l.details->>'decision', 'note', l.details->>'note', 'created_at', l.created_at) order by l.created_at), '[]'::jsonb)
      from public.audit_logs l where l.application_id = p_app and l.action = 'registrar_decision')
  );
end $$;
revoke all on function public.staff_application_detail(uuid) from public, anon;
grant execute on function public.staff_application_detail(uuid) to authenticated;

-- Keep the same 12-item checklist contract as migration 17, with the hard-stop enforced here too.
create or replace function public.staff_save_review_checklist(p_app uuid, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_role text; v_district text; v_upazila text; v_ok boolean;
  item jsonb; v_id smallint; v_decision text; v_reason text; v_count integer := 0;
begin
  select role, district, upazila into v_role, v_district, v_upazila
    from public.profiles where id = auth.uid() and is_approved = true;
  if v_role not in ('sub_registrar', 'admin') then raise exception 'staff access required' using errcode = '42501'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'items must be an array' using errcode = '22023'; end if;
  select exists(select 1 from public.deed_applications a where a.id = p_app and a.status = 'under_review'
    and (v_role = 'admin' or (a.office_district = v_district and a.office_upazila = v_upazila))) into v_ok;
  if not v_ok then raise exception 'application must be under review in your jurisdiction' using errcode = '42501'; end if;
  if app.ldis_has_government_interest(p_app) then
    raise exception 'Government-interest record found: checklist updates are disabled; only Reject is allowed.' using errcode = 'AP001';
  end if;
  for item in select value from jsonb_array_elements(p_items) loop
    v_id := (item->>'item_id')::smallint; v_decision := item->>'decision'; v_reason := btrim(coalesce(item->>'reason', ''));
    if v_id is null or v_id not between 1 and 12 or v_decision is null or v_decision not in ('correct', 'incorrect') then
      raise exception 'Every checklist item needs a Correct/Incorrect decision' using errcode = '22023';
    end if;
    if v_decision = 'incorrect' and length(v_reason) < 5 then
      raise exception 'Incorrect items require a reason of at least 5 characters' using errcode = '22023';
    end if;
    insert into public.registrar_review_checklist(application_id, item_id, decision, reason, reviewed_by, reviewed_at)
    values (p_app, v_id, v_decision, v_reason, auth.uid(), now())
    on conflict (application_id, item_id) do update set decision = excluded.decision, reason = excluded.reason, reviewed_by = excluded.reviewed_by, reviewed_at = excluded.reviewed_at;
    v_count := v_count + 1;
  end loop;
  insert into public.audit_logs(actor_id, actor_role, action, application_id, details)
  values (auth.uid(), v_role, 'registrar_checklist_saved', p_app, jsonb_build_object('submitted_items', v_count));
  return public.staff_get_review_checklist(p_app);
end $$;
revoke all on function public.staff_save_review_checklist(uuid, jsonb) from public, anon;
grant execute on function public.staff_save_review_checklist(uuid, jsonb) to authenticated;

-- The finalization function keeps the existing registration tables / archive trigger, but adds explicit evidence checks.
create or replace function public.staff_finalize_registration(p_app uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_role text; v_district text; v_upazila text; v_approved boolean;
  a public.deed_applications%rowtype; v_ref text; v_snapshot jsonb; v_demo_no text;
  v_name_score numeric; v_attestation_verified boolean := false; v_affidavit_received boolean := false;
  v_total integer := 0; v_correct integer := 0;
begin
  select role, district, upazila, is_approved into v_role, v_district, v_upazila, v_approved
    from public.profiles where id = auth.uid();
  if v_approved is distinct from true or v_role not in ('sub_registrar', 'admin') then
    raise exception 'approved staff access required' using errcode = '42501';
  end if;
  select * into a from public.deed_applications x
   where x.id = p_app and (v_role = 'admin' or (x.office_district = v_district and x.office_upazila = v_upazila))
   for update;
  if not found then raise exception 'application not found' using errcode = '42501'; end if;
  if app.ldis_has_government_interest(p_app) then
    raise exception 'Government-interest record found: registration is prohibited. Only Reject is allowed.' using errcode = 'AP001';
  end if;
  if a.status <> 'under_review' then raise exception 'Application must be Under review before finalization.' using errcode = 'AP001'; end if;
  if a.deed_nature is null or a.deed_date is null then raise exception 'Deed nature and date are required.' using errcode = 'AP001'; end if;
  if a.biometric_status is distinct from 'completed' then raise exception 'Biometric appointment status is not recorded as completed.' using errcode = 'AP001'; end if;
  if jsonb_array_length(coalesce(a.blockers, '[]'::jsonb)) > 0 then raise exception 'Application has unresolved blockers.' using errcode = 'AP001'; end if;
  select count(*), count(*) filter (where decision = 'correct') into v_total, v_correct
    from public.registrar_review_checklist where application_id = p_app;
  if v_total <> 12 or v_correct <> 12 then
    raise exception 'All 12 mandatory Sub-Registrar checklist items must be saved as Correct before registration.' using errcode = 'AP001';
  end if;
  if not exists(select 1 from public.audit_logs l where l.application_id = p_app and l.action = 'registrar_decision' and l.details->>'decision' = 'approve') then
    raise exception 'Registrar approval decision must be recorded before finalization. Complete step 5 (Approve registration) first.' using errcode = 'AP001';
  end if;
  select o.name_score into v_name_score from public.application_ownership o where o.application_id = p_app and o.route = 'record_owner';
  select coalesce(e.attestation_verified, false), coalesce(e.affidavit_received, false)
    into v_attestation_verified, v_affidavit_received from public.application_identity_evidence e where e.application_id = p_app;
  v_attestation_verified := coalesce(v_attestation_verified, false);
  v_affidavit_received := coalesce(v_affidavit_received, false);
  if v_name_score is not null and v_name_score >= 0.5 and v_name_score < 0.9 and not v_attestation_verified then
    raise exception 'Name match is 50%%-89%%: verify the uploaded Attestation before registration.' using errcode = 'AP001';
  end if;
  if v_name_score is not null and v_name_score < 0.5 and not v_affidavit_received then
    raise exception 'Name match is below 50%%: the Sub-Registrar must record receipt of the original Affidavit on biometric day.' using errcode = 'AP001';
  end if;
  if exists (
    select 1 from public.application_challans c
    where c.application_id = p_app and not exists (
      select 1 from ref.echallans e where ref.bn2en(e.challan_no) = ref.bn2en(c.challan_no)
        and e.amount = c.amount and e.fee_type = c.challan_type and e.verify_status = 'verified'
        and (e.used_in_application_no is null or e.used_in_application_no = a.application_no)
    )
  ) then raise exception 'Challan verification precondition failed. Check every challan against the reference record.' using errcode = 'AP001'; end if;
  if exists(select 1 from public.registration_register where application_id = p_app) then
    raise exception 'Application already has a registration record.' using errcode = 'AP001';
  end if;

  v_ref := 'DEMO-' || to_char(now() at time zone 'Asia/Dhaka', 'YYYY') || '-' || lpad(nextval('app.registration_ref_seq')::text, 8, '0');
  v_snapshot := jsonb_build_object(
    'application_no', a.application_no, 'deed_nature', a.deed_nature, 'deed_date', a.deed_date,
    'district', a.district, 'upazila', a.upazila, 'mouza', a.mouza,
    'khatian_type', a.khatian_type, 'khatian_no', a.khatian_no, 'sale_price', a.sale_price,
    'flags', a.flags,
    'parties', (select coalesce(jsonb_agg(jsonb_build_object('role', p.role, 'name_bn', p.name_bn, 'nid_masked', p.nid_masked)), '[]'::jsonb) from public.application_parties p where p.application_id = p_app),
    'plots', (select coalesce(jsonb_agg(jsonb_build_object('dag_no', p.dag_no, 'area_sold', p.area_sold, 'land_class', p.land_class)), '[]'::jsonb) from public.application_plots p where p.application_id = p_app),
    'identity_evidence', jsonb_build_object('attestation_verified', v_attestation_verified, 'affidavit_received', v_affidavit_received)
  );
  insert into public.registration_register(application_id, registration_ref, registered_by, mode, snapshot)
  values (p_app, v_ref, auth.uid(), 'DEMO', v_snapshot);
  update public.deed_applications set status = 'registered', updated_at = now() where id = p_app;
  insert into public.application_status_history(application_id, from_status, to_status, actor_id, actor_role, note)
  values (p_app, 'under_review', 'registered', auth.uid(), v_role, 'DEMO registration finalized; not official government registration');
  insert into public.audit_logs(actor_id, actor_role, action, application_id, details)
  values (auth.uid(), v_role, 'demo_registration_finalized', p_app, jsonb_build_object('registration_ref', v_ref, 'mode', 'DEMO'));
  select d.demo_deed_no into v_demo_no from public.registered_deeds d where d.application_id = p_app;
  return jsonb_build_object(
    'ok', true, 'mode', 'DEMO', 'registration_ref', v_ref, 'demo_deed_no', v_demo_no, 'registered_at', now(),
    'notice', 'DEMO ONLY — not an official government registration or legally valid deed.'
  );
end $$;
revoke all on function public.staff_finalize_registration(uuid) from public, anon;
grant execute on function public.staff_finalize_registration(uuid) to authenticated;

commit;
