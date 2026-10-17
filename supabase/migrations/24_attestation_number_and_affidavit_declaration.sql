-- LDIS migration 24: applicant verifies Attestation by number; Affidavit has no table/columns/upload/online verification.
-- The required Sub-Registrar statement is kept as a signed-role audit event, not as an Affidavit database.
-- Apply after migration 23. Additive to existing app and reference schema.
begin;

alter table public.application_identity_evidence add column if not exists attestation_no text;

-- Remove the old Affidavit-status columns introduced in migration 23; only attestation evidence remains here.
alter table public.application_identity_evidence drop column if exists affidavit_received;
alter table public.application_identity_evidence drop column if exists affidavit_received_by;
alter table public.application_identity_evidence drop column if exists affidavit_received_at;
alter table public.application_identity_evidence drop column if exists affidavit_note;

create or replace function app.ldis_reset_evidence_after_ownership_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_app uuid;
begin
  if tg_op = 'DELETE' then v_app := old.application_id; else v_app := new.application_id; end if;
  update public.application_identity_evidence
     set attestation_verified = false, attestation_verified_by = null,
         attestation_verified_at = null, attestation_no = null, updated_at = now()
   where application_id = v_app;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
revoke all on function app.ldis_reset_evidence_after_ownership_change() from public, anon, authenticated;

create or replace function app.ldis_reset_evidence_after_donor_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.application_identity_evidence
     set attestation_verified = false, attestation_verified_by = null,
         attestation_verified_at = null, attestation_no = null, updated_at = now()
   where application_id = new.application_id;
  return new;
end $$;
revoke all on function app.ldis_reset_evidence_after_donor_change() from public, anon, authenticated;

create or replace function app.view(p_app uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.deed_applications%rowtype; kh jsonb := null; res jsonb;
begin
  select * into a from public.deed_applications where id = p_app;
  if a.khatian_id is not null then
    select jsonb_build_object(
      'owners', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'serial', o.serial, 'owner_name', o.owner_name, 'father_name', o.father_name, 'share', o.share) order by o.serial) from ref.khatian_owners o where o.khatian_id = a.khatian_id), '[]'::jsonb),
      'dags', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'serial', d.serial, 'dag_no', d.dag_no, 'land_class', d.land_class, 'area', d.area) order by d.serial) from ref.khatian_dags d where d.khatian_id = a.khatian_id), '[]'::jsonb),
      'share_total', (select coalesce(sum(share), 0) from ref.khatian_owners where khatian_id = a.khatian_id)) into kh;
  end if;
  select jsonb_build_object(
    'application',to_jsonb(a),'khatian',kh,
    'parties',coalesce((select jsonb_agg(to_jsonb(p)-'application_id'-'person_id') from public.application_parties p where p.application_id=a.id),'[]'::jsonb),
    'ownership',(select to_jsonb(o)-'application_id'-'baya_deed_id' from public.application_ownership o where o.application_id=a.id),
    'identity_evidence', jsonb_build_object(
      'attestation_verified', coalesce((select e.attestation_verified from public.application_identity_evidence e where e.application_id=a.id), false),
      'attestation_no', (select e.attestation_no from public.application_identity_evidence e where e.application_id=a.id),
      'attestation_verified_at', (select e.attestation_verified_at from public.application_identity_evidence e where e.application_id=a.id)
    ),
    'plots',coalesce((select jsonb_agg(to_jsonb(x)-'application_id' order by x.created_at) from public.application_plots x where x.application_id=a.id),'[]'::jsonb),
    'witnesses',coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'serial',w.serial,'name',w.name,'father_name',w.father_name) order by w.serial) from public.application_witnesses w where w.application_id=a.id),'[]'::jsonb),
    'fee_items',coalesce((select jsonb_agg(to_jsonb(f)-'application_id' order by f.fee_code) from public.application_fee_items f where f.application_id=a.id),'[]'::jsonb),
    'challans',coalesce((select jsonb_agg(to_jsonb(c)-'application_id'-'challan_no_norm') from public.application_challans c where c.application_id=a.id),'[]'::jsonb),
    'appointment',(select to_jsonb(ap)-'application_id' from public.application_appointments ap where ap.application_id=a.id and ap.status in ('booked','confirmed')),
    'appointment_events',coalesce((select jsonb_agg(jsonb_build_object('event',e.event,'detail',e.detail,'created_at',e.created_at) order by e.id) from public.application_appointment_events e where e.application_id=a.id),'[]'::jsonb),
    'documents',coalesce((select jsonb_agg(to_jsonb(d)-'application_id' order by d.created_at) from public.application_documents d where d.application_id=a.id),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(jsonb_build_object('from_status',h.from_status,'to_status',h.to_status,'actor_role',h.actor_role,'note',h.note,'created_at',h.created_at) order by h.id) from public.application_status_history h where h.application_id=a.id),'[]'::jsonb),
    'corrections',coalesce((select jsonb_agg(to_jsonb(c)-'application_id'-'requested_by' order by c.requested_at) from public.application_corrections c where c.application_id=a.id),'[]'::jsonb)
  ) into res;
  return res;
end $$;
revoke all on function app.view(uuid) from public, anon;
grant execute on function app.view(uuid) to authenticated;

create or replace function public.app_verify_attestation_number(p_app uuid, p_attestation_no text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a public.deed_applications%rowtype;
  o public.application_ownership%rowtype;
  donor public.application_parties%rowtype;
  ko ref.khatian_owners%rowtype;
  pr ref.nid_persons%rowtype;
  att ref.name_attestations%rowtype;
  v_count integer := 0;
  v_message text;
  v_verified boolean := false;
begin
  a := app.load_editable(p_app);
  if length(btrim(coalesce(p_attestation_no, ''))) < 2 or length(btrim(p_attestation_no)) > 80 then
    raise exception 'Enter a valid Attestation certificate number.' using errcode = '22023';
  end if;

  select * into o from public.application_ownership x where x.application_id = p_app and x.route = 'record_owner';
  if not found or o.name_score is null or o.name_score < 0.5 or o.name_score >= 0.9 then
    raise exception 'Attestation number verification applies only to recorded-owner name match from 50%% to below 90%%.' using errcode = 'AP001';
  end if;
  select * into donor from public.application_parties x where x.application_id = p_app and x.role = 'donor';
  if not found then raise exception 'Verify the donor NID before Attestation lookup.' using errcode = 'AP001'; end if;
  select * into ko from ref.khatian_owners x where x.id = o.owner_id and x.khatian_id = a.khatian_id;
  if not found then raise exception 'Selected recorded owner was not found; save ownership again.' using errcode = 'AP001'; end if;
  select * into pr from ref.nid_persons x where x.id = donor.person_id;
  if not found then raise exception 'Donor NID reference record was not found.' using errcode = 'AP001'; end if;

  select count(*) into v_count
  from ref.name_attestations x
  where upper(ref.bn2en(btrim(x.attestation_no))) = upper(ref.bn2en(btrim(p_attestation_no)))
    and x.person_id = donor.person_id
    and (
      (app.name_similarity(x.name_variant_a, ko.owner_name) >= 0.99 and app.name_similarity(x.name_variant_b, pr.name_bn) >= 0.99)
      or (app.name_similarity(x.name_variant_b, ko.owner_name) >= 0.99 and app.name_similarity(x.name_variant_a, pr.name_bn) >= 0.99)
      or (app.name_similarity(x.name_variant_a, ko.father_name) >= 0.99 and app.name_similarity(x.name_variant_b, pr.father_name) >= 0.99)
      or (app.name_similarity(x.name_variant_b, ko.father_name) >= 0.99 and app.name_similarity(x.name_variant_a, pr.father_name) >= 0.99)
    );

  if v_count = 1 then
    select * into att from ref.name_attestations x
    where upper(ref.bn2en(btrim(x.attestation_no))) = upper(ref.bn2en(btrim(p_attestation_no)))
      and x.person_id = donor.person_id
      and (
        (app.name_similarity(x.name_variant_a, ko.owner_name) >= 0.99 and app.name_similarity(x.name_variant_b, pr.name_bn) >= 0.99)
        or (app.name_similarity(x.name_variant_b, ko.owner_name) >= 0.99 and app.name_similarity(x.name_variant_a, pr.name_bn) >= 0.99)
        or (app.name_similarity(x.name_variant_a, ko.father_name) >= 0.99 and app.name_similarity(x.name_variant_b, pr.father_name) >= 0.99)
        or (app.name_similarity(x.name_variant_b, ko.father_name) >= 0.99 and app.name_similarity(x.name_variant_a, pr.father_name) >= 0.99)
      ) limit 1;
    insert into public.application_identity_evidence(application_id, attestation_verified, attestation_verified_by, attestation_verified_at, attestation_no, updated_at)
    values (p_app, true, auth.uid(), now(), att.attestation_no, now())
    on conflict (application_id) do update set
      attestation_verified = true, attestation_verified_by = excluded.attestation_verified_by,
      attestation_verified_at = excluded.attestation_verified_at, attestation_no = excluded.attestation_no, updated_at = now();
    v_verified := true;
    v_message := 'প্রত্যয়নপত্র নম্বর পাওয়া গেছে এবং নামের variant-এর সঙ্গে মিলেছে। এটি আইনগত মালিকানার প্রমাণ নয়; সাব-রেজিস্ট্রার চূড়ান্ত পর্যালোচনা করবেন।';
    insert into public.audit_logs(actor_id, actor_role, action, application_id, details)
    values (auth.uid(), 'user', 'app_attestation_number_verified', p_app,
      jsonb_build_object('attestation_no', att.attestation_no, 'issuer', att.issued_by, 'issue_date', att.issue_date));
  else
    update public.application_identity_evidence
       set attestation_verified = false, attestation_verified_by = null, attestation_verified_at = null,
           attestation_no = null, updated_at = now()
     where application_id = p_app;
    v_message := case when v_count > 1
      then 'এই নম্বরের একাধিক মিলে যাওয়া প্রত্যয়ন রেকর্ড পাওয়া গেছে। Data Entry/Admin-এর মাধ্যমে reference record ঠিক করান।'
      else 'এই প্রত্যয়ন নম্বরটি পাওয়া যায়নি, অথবা নম্বরটি দাতা ও নির্বাচিত পর্চার মালিকের নাম-ভ্যারিয়েন্টের সঙ্গে মেলেনি। নম্বরটি যাচাই করে আবার দিন।' end;
    insert into public.audit_logs(actor_id, actor_role, action, application_id, details)
    values (auth.uid(), 'user', 'app_attestation_number_check_failed', p_app,
      jsonb_build_object('attestation_no_input', left(btrim(p_attestation_no), 80), 'matching_records', v_count));
  end if;

  perform app.recompute(p_app);
  return jsonb_build_object('ok', true, 'verified', v_verified, 'message', v_message, 'application', app.view(p_app),
    'attestation', case when v_verified then jsonb_build_object('attestation_no', att.attestation_no, 'issued_by', att.issued_by, 'issue_date', att.issue_date, 'name_variant_a', att.name_variant_a, 'name_variant_b', att.name_variant_b) else null end);
end $$;
revoke all on function public.app_verify_attestation_number(uuid, text) from public, anon;
grant execute on function public.app_verify_attestation_number(uuid, text) to authenticated;

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
  v_ownership_verified_at timestamptz;
  v_donor_verified_at timestamptz;
  v_declaration text := 'আমি আবেদনকারীর মূল Affidavit নিজে দেখেছি এবং সংশ্লিষ্ট আদালত থেকে ম্যানুয়ালি যাচাই করেছি। Affidavit-এ কোনো অসঙ্গতি, জালিয়াতি বা ভুল থাকলে তার দায় আমি, দায়িত্বপ্রাপ্ত সাব-রেজিস্ট্রার, গ্রহণ করছি।';
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
    'declare_affidavit_checked'
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
  if p_decision in ('approve', 'confirm_appointment', 'mark_biometric_completed', 'mark_biometric_failed', 'declare_affidavit_checked') and a.status <> 'under_review' then
    raise exception 'Start review first; this action requires Under review status.' using errcode = 'AP001';
  end if;

  select o.name_score, o.verified_at into v_name_score, v_ownership_verified_at
    from public.application_ownership o where o.application_id = p_app and o.route = 'record_owner';
  select max(p.verified_at) into v_donor_verified_at
    from public.application_parties p where p.application_id = p_app and p.role = 'donor';
  select coalesce(e.attestation_verified, false) into v_attestation_verified
    from public.application_identity_evidence e where e.application_id = p_app;
  v_attestation_verified := coalesce(v_attestation_verified, false);

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

  elsif p_decision = 'declare_affidavit_checked' then
    if v_role <> 'sub_registrar' then
      raise exception 'Only the responsible Sub-Registrar may make the Affidavit manual-verification declaration.' using errcode = '42501';
    end if;
    if btrim(coalesce(p_note, '')) <> v_declaration then
      raise exception 'The exact Affidavit manual-verification and responsibility declaration must be explicitly confirmed.' using errcode = '22023';
    end if;
    if a.biometric_status is distinct from 'completed' then
      raise exception 'Record biometric completion first; the original Affidavit declaration is only allowed after the biometric-day check.' using errcode = 'AP001';
    end if;
    if v_name_score is null or v_name_score >= 0.5 then
      raise exception 'This Affidavit declaration applies only when the recorded-owner name match is below 50%%.' using errcode = 'AP001';
    end if;
    if v_ownership_verified_at is null or v_donor_verified_at is null then
      raise exception 'Current donor and ownership records must be saved before making this declaration.' using errcode = 'AP001';
    end if;

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
      raise exception 'Name match is 50%%-89%%: the applicant must verify a valid Attestation certificate number against the reference database before approval.' using errcode = 'AP001';
    end if;
    if v_name_score is not null and v_name_score < 0.5 and not exists (
      select 1 from public.audit_logs l
      where l.application_id = p_app and l.action = 'registrar_decision'
        and l.actor_role = 'sub_registrar'
        and l.details->>'decision' = 'declare_affidavit_checked'
        and l.details->>'court_manual_verification_confirmed' = 'true'
        and l.details->>'responsibility_accepted' = 'true'
        and l.details->>'ownership_verified_version' = to_char(v_ownership_verified_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US')
        and l.details->>'donor_verified_version' = to_char(v_donor_verified_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US')
    ) then
      raise exception 'Name match is below 50%%: the responsible Sub-Registrar must declare that the original Affidavit was seen and manually verified with the court, accepting responsibility.' using errcode = 'AP001';
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
    jsonb_build_object('decision', p_decision, 'note', left(coalesce(p_note, ''), 1000), 'from_status', a.status, 'to_status', v_to)
    || case when p_decision = 'declare_affidavit_checked' then jsonb_build_object(
      'declaration', v_declaration,
      'court_manual_verification_confirmed', true,
      'responsibility_accepted', true,
      'ownership_verified_version', to_char(v_ownership_verified_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
      'donor_verified_version', to_char(v_donor_verified_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US')
    ) else '{}'::jsonb end);
  insert into public.user_notifications(user_id, application_id, kind, title_bn, title_en)
  values (a.applicant_id, p_app, 'staff_update', 'আবেদনের অবস্থা হালনাগাদ', 'Application updated');
  return jsonb_build_object('ok', true, 'status', v_to, 'decision', p_decision);
end $$;
revoke all on function public.staff_decide_application(uuid, text, text, smallint[]) from public, anon;
grant execute on function public.staff_decide_application(uuid, text, text, smallint[]) to authenticated;

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
      'affidavit_declaration', exists (
        select 1 from public.audit_logs l
        join public.application_ownership o on o.application_id = l.application_id and o.route = 'record_owner'
        join public.application_parties p on p.application_id = l.application_id and p.role = 'donor'
        where l.application_id = p_app and l.action = 'registrar_decision'
          and l.actor_role = 'sub_registrar' and l.details->>'decision' = 'declare_affidavit_checked'
          and l.details->>'court_manual_verification_confirmed' = 'true' and l.details->>'responsibility_accepted' = 'true'
          and l.details->>'ownership_verified_version' = to_char(o.verified_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US')
          and l.details->>'donor_verified_version' = to_char(p.verified_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US')
      ),
      'affidavit_declaration_at', (select l.created_at from public.audit_logs l
        join public.application_ownership o on o.application_id = l.application_id and o.route = 'record_owner'
        join public.application_parties p on p.application_id = l.application_id and p.role = 'donor'
        where l.application_id = p_app and l.action = 'registrar_decision'
          and l.actor_role = 'sub_registrar' and l.details->>'decision' = 'declare_affidavit_checked'
          and l.details->>'court_manual_verification_confirmed' = 'true' and l.details->>'responsibility_accepted' = 'true'
          and l.details->>'ownership_verified_version' = to_char(o.verified_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US')
          and l.details->>'donor_verified_version' = to_char(p.verified_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US')
        order by l.created_at desc limit 1),
      'affidavit_declaration_text', (select l.details->>'declaration' from public.audit_logs l
        join public.application_ownership o on o.application_id = l.application_id and o.route = 'record_owner'
        join public.application_parties p on p.application_id = l.application_id and p.role = 'donor'
        where l.application_id = p_app and l.action = 'registrar_decision'
          and l.actor_role = 'sub_registrar' and l.details->>'decision' = 'declare_affidavit_checked'
          and l.details->>'court_manual_verification_confirmed' = 'true' and l.details->>'responsibility_accepted' = 'true'
          and l.details->>'ownership_verified_version' = to_char(o.verified_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US')
          and l.details->>'donor_verified_version' = to_char(p.verified_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US')
        order by l.created_at desc limit 1),
      'affidavit_declaration_by', (select l.actor_id::text from public.audit_logs l
        join public.application_ownership o on o.application_id = l.application_id and o.route = 'record_owner'
        join public.application_parties p on p.application_id = l.application_id and p.role = 'donor'
        where l.application_id = p_app and l.action = 'registrar_decision'
          and l.actor_role = 'sub_registrar' and l.details->>'decision' = 'declare_affidavit_checked'
          and l.details->>'court_manual_verification_confirmed' = 'true' and l.details->>'responsibility_accepted' = 'true'
          and l.details->>'ownership_verified_version' = to_char(o.verified_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US')
          and l.details->>'donor_verified_version' = to_char(p.verified_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US')
        order by l.created_at desc limit 1)
    ),
    'applicant', (select jsonb_build_object('full_name', p.full_name, 'email', p.email) from public.profiles p where p.id = a.applicant_id),
    'parties', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.application_parties x where x.application_id = p_app),
    'witnesses', (select coalesce(jsonb_agg(to_jsonb(x) - 'application_id' order by x.serial), '[]'::jsonb) from public.application_witnesses x where x.application_id = p_app),
    'ownership', (select to_jsonb(x) || jsonb_build_object(
      'attestation_verified', coalesce((select e.attestation_verified from public.application_identity_evidence e where e.application_id = p_app), false),
      'attestation_no', (select e.attestation_no from public.application_identity_evidence e where e.application_id = p_app),
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

create or replace function public.staff_finalize_registration(p_app uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_role text; v_district text; v_upazila text; v_approved boolean;
  a public.deed_applications%rowtype; v_ref text; v_snapshot jsonb; v_demo_no text;
  v_name_score numeric; v_attestation_verified boolean := false; v_attestation_no text;
  v_ownership_verified_at timestamptz; v_donor_verified_at timestamptz;
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
  select o.name_score, o.verified_at into v_name_score, v_ownership_verified_at from public.application_ownership o where o.application_id = p_app and o.route = 'record_owner';
  select max(p.verified_at) into v_donor_verified_at from public.application_parties p where p.application_id = p_app and p.role = 'donor';
  select coalesce(e.attestation_verified, false), e.attestation_no
    into v_attestation_verified, v_attestation_no from public.application_identity_evidence e where e.application_id = p_app;
  v_attestation_verified := coalesce(v_attestation_verified, false);
  if v_name_score is not null and v_name_score >= 0.5 and v_name_score < 0.9 and not v_attestation_verified then
    raise exception 'Name match is 50%%-89%%: verify the Attestation certificate number against the reference database before registration.' using errcode = 'AP001';
  end if;
  if v_name_score is not null and v_name_score < 0.5 and not exists (
    select 1 from public.audit_logs l
    where l.application_id = p_app and l.action = 'registrar_decision'
      and l.actor_role = 'sub_registrar'
      and l.details->>'decision' = 'declare_affidavit_checked'
      and l.details->>'court_manual_verification_confirmed' = 'true'
      and l.details->>'responsibility_accepted' = 'true'
      and l.details->>'ownership_verified_version' = to_char(v_ownership_verified_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US')
      and l.details->>'donor_verified_version' = to_char(v_donor_verified_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US')
  ) then
    raise exception 'Name match is below 50%%: the Sub-Registrar must record the original Affidavit and court manual-verification declaration, accepting responsibility, before registration.' using errcode = 'AP001';
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
    'identity_evidence', jsonb_build_object('attestation_verified', v_attestation_verified, 'attestation_no', v_attestation_no)
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
