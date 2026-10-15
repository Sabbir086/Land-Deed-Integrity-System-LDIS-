-- =====================================================================
-- 08_application_logic.sql  (Stage 2)  -- functions only, idempotent
-- Internal helpers in schema `app` (not exposed through the API; no grants).
-- All derived values (identity outcome, entitlement, remaining land, flags, fees,
-- blockers) are RECOMPUTED here from stored inputs + ref.* on every save and at submit.
-- Nothing numeric or decisional is accepted from the browser.
--
-- STATUS: NOT yet applied / executed (no database in the build sandbox).
-- Business-rule assumptions are labelled in the output (see ENTITLEMENT notes) and in docs.
-- =====================================================================

create or replace function app.today_bd() returns date
language sql stable set search_path = '' as $$ select (now() at time zone 'Asia/Dhaka')::date $$;

create or replace function app.flag(p_code text, p_level text, p_bn text, p_en text, p_detail text, p_source text) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('code', p_code, 'level', p_level, 'bn', p_bn, 'en', p_en, 'detail', coalesce(p_detail, ''), 'source', p_source)
$$;

create or replace function app.blocker(p_code text, p_step int, p_bn text, p_en text) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('code', p_code, 'step', p_step, 'bn', p_bn, 'en', p_en)
$$;

-- Port of lib/verify/matching.js similarity(): 1 - levenshtein / longest, NULL if either side empty.
create or replace function app.name_similarity(a text, b text) returns numeric
language plpgsql immutable set search_path = '' as $$
declare la text; lb text; x text[]; y text[]; n int; m int; prev int[]; cur int[]; i int; j int; cost int;
begin
  la := btrim(regexp_replace(regexp_replace(normalize(coalesce(a, ''), NFC), '[\u200c\u200d]', '', 'g'), '\s+', ' ', 'g'));
  lb := btrim(regexp_replace(regexp_replace(normalize(coalesce(b, ''), NFC), '[\u200c\u200d]', '', 'g'), '\s+', ' ', 'g'));
  if la = '' or lb = '' then return null; end if;
  x := regexp_split_to_array(la, ''); y := regexp_split_to_array(lb, '');
  n := array_length(x, 1); m := array_length(y, 1);
  prev := array(select generate_series(0, m));
  for i in 1..n loop
    cur := array[i];
    for j in 1..m loop
      cost := case when x[i] = y[j] then 0 else 1 end;
      cur[j + 1] := least(prev[j + 1] + 1, cur[j] + 1, prev[j] + cost);
    end loop;
    prev := cur;
  end loop;
  return 1 - (prev[m + 1])::numeric / greatest(n, m);
end $$;

-- Caller must be a signed-in user with role 'user' (applicants). Returns auth.uid().
create or replace function app.assert_applicant() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_role text;
begin
  v_role := ref.assert_app_user();                 -- 28000 / 42501
  if v_role <> 'user' then
    raise exception 'only applicant accounts can manage applications' using errcode = '42501';
  end if;
  return (select auth.uid());
end $$;

-- Throttle: at most p_limit calls of p_kind per user per p_minutes. Raises AP002.
create or replace function app.rate_check(p_uid uuid, p_kind text, p_limit int, p_minutes int) returns void
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  select count(*) into n from app.lookup_attempts where user_id = p_uid and kind = p_kind and attempted_at > now() - make_interval(mins => p_minutes);
  if n >= p_limit then
    raise exception 'too many attempts, please wait a few minutes' using errcode = 'AP002';
  end if;
  insert into app.lookup_attempts (user_id, kind) values (p_uid, p_kind);
  delete from app.lookup_attempts where attempted_at < now() - interval '2 days' and user_id = p_uid;
end $$;

-- Loads an application owned by the caller, locked for update. Any status.
create or replace function app.load_owned(p_app uuid) returns public.deed_applications
language plpgsql security definer set search_path = '' as $$
declare a public.deed_applications%rowtype; v_uid uuid;
begin
  v_uid := app.assert_applicant();
  select * into a from public.deed_applications x where x.id = p_app and x.applicant_id = v_uid for update;
  if not found then raise exception 'application not found' using errcode = '42501'; end if;  -- same answer for "not yours"
  return a;
end $$;

-- Loads an owned application that may still be edited (draft or correction_requested).
create or replace function app.load_editable(p_app uuid) returns public.deed_applications
language plpgsql security definer set search_path = '' as $$
declare a public.deed_applications%rowtype;
begin
  a := app.load_owned(p_app);
  if a.status not in ('draft', 'correction_requested') then
    raise exception 'this application can no longer be edited (status: %)', a.status using errcode = 'AP001';
  end if;
  return a;
end $$;

create or replace function app.notify(p_user uuid, p_app uuid, p_kind text, p_bn text, p_en text) returns void
language sql security definer set search_path = '' as $$
  insert into public.user_notifications (user_id, application_id, kind, title_bn, title_en) values (p_user, p_app, p_kind, p_bn, p_en)
$$;

-- Status change guarded by the documented rules table (public.application_status_rules).
create or replace function app.change_status(p_app uuid, p_to text, p_actor uuid, p_role text, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare cur text;
begin
  select status into cur from public.deed_applications where id = p_app;
  if not exists (select 1 from public.application_status_rules r
                  where r.from_status = cur and r.to_status = p_to and r.actor_role = p_role and r.active) then
    raise exception 'status change % -> % is not allowed', cur, p_to using errcode = 'AP001';
  end if;
  update public.deed_applications set status = p_to where id = p_app;
  insert into public.application_status_history (application_id, from_status, to_status, actor_id, actor_role, note)
  values (p_app, cur, p_to, p_actor, p_role, p_note);
end $$;

-- ---------------------------------------------------------------------
-- RECOMPUTE: the single source of truth for every derived value.
-- Re-reads people, khatian, owners, deeds, warish, khas, fees and challans from the
-- reference data; rewrites derived columns; returns {flags, blockers}.
-- Caller must already hold the application row lock (load_owned/load_editable).
-- ---------------------------------------------------------------------
create or replace function app.recompute(p_app uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  TOL constant numeric := 0.00005;
  a public.deed_applications%rowtype;
  v_flags jsonb := '[]'::jsonb;  v_blockers jsonb := '[]'::jsonb;
  donor public.application_parties%rowtype; donee public.application_parties%rowtype;
  pr ref.nid_persons%rowtype;  k ref.khatians%rowtype;  ko ref.khatian_owners%rowtype;
  o public.application_ownership%rowtype;
  wc ref.warish_certs%rowtype; wh ref.warish_heirs%rowtype; bd ref.deeds%rowtype;
  pl public.application_plots%rowtype; dg ref.khatian_dags%rowtype; ch public.application_challans%rowtype; rc ref.echallans%rowtype;
  share_tot numeric; s_name numeric; s_father numeric; outcome text; bridging boolean; o_status text; o_checks jsonb;
  v_heir_share numeric; v_heir_rel text; heirs_tot numeric; bn_cnt int; baya_ok boolean := false;
  v_ent numeric; v_sold numeric; v_rem numeric; v_all numeric; v_other int; v_hist jsonb; v_khas jsonb; v_assume text[];
  any_khas boolean := false; n_plots int := 0; fee_sum numeric; due numeric; t record; n_appt int; n_docs int; appt public.application_appointments%rowtype;
  ko_found boolean := false; dag_nos text[] := '{}';
begin
  select * into a from public.deed_applications where id = p_app;

  -- 1. parties --------------------------------------------------------
  select * into donor from public.application_parties where application_id = p_app and role = 'donor';
  select * into donee from public.application_parties where application_id = p_app and role = 'donee';
  if donor.id is null then v_blockers := v_blockers || app.blocker('DONOR_MISSING', 1, 'দাতার পরিচয় যাচাই করুন', 'Verify the donor identity'); end if;
  if donee.id is null then v_blockers := v_blockers || app.blocker('DONEE_MISSING', 1, 'গ্রহীতার পরিচয় যাচাই করুন', 'Verify the donee identity'); end if;
  if donor.id is not null and donee.id is not null and donor.person_id = donee.person_id then
    v_blockers := v_blockers || app.blocker('SAME_PERSON', 1, 'দাতা ও গ্রহীতা একই ব্যক্তি হতে পারে না', 'Donor and donee cannot be the same person');
  end if;
  for pr in select n.* from ref.nid_persons n where n.id in (donor.person_id, donee.person_id) loop
    if not exists (select 1 from public.application_parties p where p.application_id = p_app and p.person_id = pr.id and p.dob = pr.dob) then
      v_blockers := v_blockers || app.blocker('PERSON_RECORD_CHANGED', 1, 'ব্যক্তির রেকর্ড বদলেছে, আবার যাচাই করুন', 'A person record changed; verify again');
    end if;
  end loop;

  -- 2. khatian ----------------------------------------------------------
  if a.khatian_id is null then
    v_blockers := v_blockers || app.blocker('KHATIAN_MISSING', 2, 'খতিয়ান নির্বাচন করুন', 'Select the khatian');
  else
    select * into k from ref.khatians where id = a.khatian_id;
    if not found then
      v_blockers := v_blockers || app.blocker('KHATIAN_GONE', 2, 'খতিয়ান পাওয়া যাচ্ছে না', 'The khatian record is no longer available');
    else
      select coalesce(sum(share), 0) into share_tot from ref.khatian_owners where khatian_id = k.id;
      if abs(share_tot - 1) >= 0.0005 then
        v_flags := v_flags || app.flag('OWNER_SHARE_TOTAL', 'medium', 'মালিকদের অংশের যোগফল ১ নয়', 'Recorded owner shares do not total 1', 'Total = ' || share_tot, 'ref.khatian_owners');
      end if;
    end if;
  end if;

  -- 3. ownership basis ---------------------------------------------------
  select * into o from public.application_ownership where application_id = p_app;
  if o.id is null then
    v_blockers := v_blockers || app.blocker('OWNERSHIP_MISSING', 3, 'মালিকানার ভিত্তি নির্বাচন করুন', 'Choose the ownership basis');
  elsif k.id is not null then
    o_status := case when donor.id is null then 'blocked' else 'provisional' end; o_checks := '{}'::jsonb; v_heir_share := null; v_heir_rel := null; bd := null;
    if o.route in ('record_owner', 'warish') then
      select * into ko from ref.khatian_owners x where x.id = o.owner_id and x.khatian_id = a.khatian_id;
      ko_found := found;
      if not ko_found then
        v_blockers := v_blockers || app.blocker('OWNER_MISSING', 3, 'পর্চার মালিক নির্বাচন করুন', 'Select the recorded owner on the porcha');
        o_status := 'blocked';
      end if;
    end if;

    if o.route = 'record_owner' and ko_found and donor.id is not null then
      select * into pr from ref.nid_persons where id = donor.person_id;
      s_name := app.name_similarity(ko.owner_name, pr.name_bn);
      s_father := app.name_similarity(ko.father_name, pr.father_name);
      if s_name is null or s_father is null then outcome := 'insufficient_data';
      elsif least(s_name, s_father) >= 0.9 then outcome := 'meets_provisional_threshold';
      else outcome := 'discrepancy_review'; end if;
      select exists (select 1 from ref.name_attestations att where att.person_id = pr.id and (
          (app.name_similarity(att.name_variant_a, ko.owner_name) >= 0.99 and app.name_similarity(att.name_variant_b, pr.name_bn) >= 0.99)
       or (app.name_similarity(att.name_variant_b, ko.owner_name) >= 0.99 and app.name_similarity(att.name_variant_a, pr.name_bn) >= 0.99)
       or (app.name_similarity(att.name_variant_a, ko.father_name) >= 0.99 and app.name_similarity(att.name_variant_b, pr.father_name) >= 0.99)
       or (app.name_similarity(att.name_variant_b, ko.father_name) >= 0.99 and app.name_similarity(att.name_variant_a, pr.father_name) >= 0.99)))
        into bridging;
      o_checks := jsonb_build_object('threshold', 0.9, 'name_score', s_name, 'father_score', s_father, 'outcome', outcome, 'attestation_bridges', bridging);
      if outcome = 'discrepancy_review' then
        o_status := 'review';
        v_flags := v_flags || app.flag('NID_PORCHA_MISMATCH', 'high', 'NID ও পর্চার তথ্যে অমিল', 'NID and porcha details do not meet the provisional 90% match',
                   'Name ' || round(coalesce(s_name, 0) * 100) || '%, father/spouse ' || round(coalesce(s_father, 0) * 100) || '%. Held for discrepancy review.', 'ref.khatian_owners vs ref.nid_persons');
        if bridging then v_flags := v_flags || app.flag('ATTESTATION_BRIDGES', 'info', 'নামের অমিলের প্রত্যয়নপত্র আছে', 'A name-attestation record references these spellings', 'Still needs human review.', 'ref.name_attestations'); end if;
      elsif outcome = 'insufficient_data' then
        o_status := 'review';
        v_flags := v_flags || app.flag('IDENTITY_DATA_MISSING', 'unknown', 'তুলনার জন্য তথ্য অসম্পূর্ণ', 'Not enough data to compare identity', 'A name or father/spouse name is missing on one side.', 'ref.khatian_owners vs ref.nid_persons');
      else
        v_flags := v_flags || app.flag('IDENTITY_MATCH_PROVISIONAL', 'info', 'প্রাথমিক মিল পাওয়া গেছে', 'Provisional identity match only', 'A matching name does not prove legal ownership or the right to transfer.', 'ref.khatian_owners vs ref.nid_persons');
      end if;

    elsif o.route = 'warish' and ko_found and donor.id is not null then
      select * into wc from ref.warish_certs c where ref.bn2en(c.cert_no) = ref.bn2en(o.warish_cert_no) limit 1;
      if not found then
        v_blockers := v_blockers || app.blocker('WARISH_NOT_FOUND', 3, 'ওয়ারিশ সার্টিফিকেট পাওয়া যায়নি', 'Warish certificate not found in the supplied database');
        o_status := 'blocked';
      else
        select * into wh from ref.warish_heirs h where h.cert_id = wc.id and h.heir_id = donor.person_id;
        if not found then
          v_blockers := v_blockers || app.blocker('DONOR_NOT_HEIR', 3, 'দাতা এই সার্টিফিকেটের ওয়ারিশ তালিকায় নেই', 'The donor is not listed as an heir on this certificate');
          o_status := 'blocked';
        else
          v_heir_share := wh.share; v_heir_rel := wh.relation;
          s_name := app.name_similarity(wc.deceased_name, ko.owner_name);
          s_father := app.name_similarity(wc.deceased_father_name, ko.father_name);
          if s_name is null or s_father is null or least(s_name, s_father) < 0.9 then
            o_status := 'review';
            v_flags := v_flags || app.flag('WARISH_DECEASED_MISMATCH', 'high', 'মৃত ব্যক্তি ও পর্চার মালিকের তথ্যে অমিল', 'Deceased on the certificate does not match the selected porcha owner', 'Needs discrepancy review.', 'ref.warish_certs vs ref.khatian_owners');
          end if;
          select coalesce(sum(share), 0) into heirs_tot from ref.warish_heirs where cert_id = wc.id;
          if abs(heirs_tot - 1) >= 0.0005 then v_flags := v_flags || app.flag('HEIR_SHARE_TOTAL', 'medium', 'ওয়ারিশদের অংশের যোগফল ১ নয়', 'Heir shares do not total 1', 'Total = ' || heirs_tot, 'ref.warish_heirs'); end if;
          if v_heir_share is null then
            o_status := 'review';
            v_flags := v_flags || app.flag('HEIR_SHARE_MISSING', 'unknown', 'ওয়ারিশের অংশ অজানা', 'Heir share is not recorded; entitlement cannot be computed', '', 'ref.warish_heirs');
          end if;
          o_checks := jsonb_build_object('cert_no', wc.cert_no, 'cert_date', wc.cert_date, 'deceased_name', wc.deceased_name,
                       'deceased_father_name', wc.deceased_father_name, 'issuing_authority', wc.issuing_authority,
                       'deceased_name_score', s_name, 'deceased_father_score', s_father, 'heir_relation', v_heir_rel, 'heir_share', v_heir_share,
                       'legal_rule_confirmed', false);
          v_flags := v_flags || app.flag('WARISH_RULE_UNCONFIRMED', 'info', 'ওয়ারিশ-অংশ গণনার আইনি নিয়ম এখনো নিশ্চিত নয়', 'Warish entitlement rule is an unconfirmed assumption', 'Entitlement = dag area × deceased owner share × heir share.', 'assumption');
        end if;
      end if;

    elsif o.route = 'baya_deed' and donor.id is not null then
      select count(*) into bn_cnt from ref.deeds d where d.deed_no_norm = ref.bn2en(o.baya_deed_no) and d.deed_date = o.baya_deed_date;
      if bn_cnt = 0 then
        v_blockers := v_blockers || app.blocker('BAYA_NOT_FOUND', 3, 'পূর্ববর্তী দলিল পাওয়া যায়নি', 'Previous deed not found for this number and date');
        o_status := 'blocked';
      elsif bn_cnt > 1 then
        o_status := 'review';
        v_flags := v_flags || app.flag('DEED_MULTIPLE', 'high', 'একই নম্বর ও তারিখে একাধিক রেকর্ড', 'Several records share this deed number and date', 'Previous-deed chain cannot be established automatically.', 'ref.deeds');
      else
        select * into bd from ref.deeds d where d.deed_no_norm = ref.bn2en(o.baya_deed_no) and d.deed_date = o.baya_deed_date;
        if bd.donee_id is distinct from donor.person_id then
          o_status := 'review';
          v_flags := v_flags || app.flag('BAYA_DONEE_MISMATCH', 'high', 'পূর্ববর্তী দলিলের গ্রহীতা ও বর্তমান দাতা এক নন', 'Donee of the previous deed is not the current donor', 'Needs discrepancy review.', 'ref.deeds');
        elsif bd.location_id is distinct from a.location_id or bd.khatian_no_norm is distinct from k.khatian_no_norm then
          o_status := 'review';
          v_flags := v_flags || app.flag('BAYA_LAND_MISMATCH', 'high', 'পূর্ববর্তী দলিলের জমি নির্বাচিত খতিয়ানের সঙ্গে মেলেনি', 'Previous deed refers to a different mouza/khatian', 'Needs discrepancy review.', 'ref.deeds');
        else
          baya_ok := true;
        end if;
        o_checks := jsonb_build_object('deed_no', bd.deed_no, 'deed_date', bd.deed_date, 'deed_type', bd.deed_type, 'dag_no', bd.dag_no,
                     'area_sold', bd.area_sold, 'donee_matches_donor', bd.donee_id is not distinct from donor.person_id, 'sub_office', bd.sub_office);
      end if;
    end if;

    update public.application_ownership set
      owner_name = ko.owner_name, owner_father_name = ko.father_name, owner_share = ko.share,
      name_score = case when o.route in ('record_owner') then s_name end, father_score = case when o.route in ('record_owner') then s_father end,
      identity_outcome = case when o.route = 'record_owner' then outcome end,
      heir_relation = v_heir_rel, heir_share = v_heir_share,
      baya_deed_id = bd.id, baya_area = case when baya_ok then bd.area_sold end,
      status = coalesce(o_status, 'provisional'), checks = coalesce(o_checks, '{}'::jsonb), verified_at = now()
     where id = o.id;
    select * into o from public.application_ownership where id = o.id;
  end if;

  -- 4. plots: entitlement / remaining land / history / khas --------------------
  for pl in select * from public.application_plots where application_id = p_app order by created_at loop
    n_plots := n_plots + 1;
    select * into dg from ref.khatian_dags x where x.id = pl.dag_id and x.khatian_id = a.khatian_id;
    if not found then
      v_blockers := v_blockers || app.blocker('PLOT_INVALID', 4, 'নির্বাচিত দাগ এই খতিয়ানের নয়', 'A selected dag does not belong to this khatian');
      continue;
    end if;
    dag_nos := dag_nos || dg.dag_no_norm;

    -- entitlement by route (ASSUMPTIONS, unconfirmed by the owner; shown to the user)
    v_ent := null; v_assume := '{}';
    if o.id is not null and o.status <> 'blocked' then
      if o.route = 'record_owner' and o.owner_share is not null then
        v_ent := dg.area * o.owner_share;
        v_assume := array['Entitlement = dag area × recorded owner share (same share assumed on every dag).'];
      elsif o.route = 'warish' and o.owner_share is not null and o.heir_share is not null then
        v_ent := dg.area * o.owner_share * o.heir_share;
        v_assume := array['Entitlement = dag area × deceased owner share × heir share (unconfirmed legal rule).'];
      elsif o.route = 'baya_deed' and baya_ok and bd.dag_no_norm = dg.dag_no_norm then
        v_ent := bd.area_sold;
        v_assume := array['Entitlement = area acquired by the previous deed on this dag (earlier part-sales of the same land not otherwise modelled).'];
      end if;
    end if;
    v_assume := v_assume || array['Only earlier SALES by the donor are subtracted; partition, joint-ownership changes and cancelled deeds are not modelled.'];

    select coalesce(sum(d.area_sold), 0) into v_sold from ref.deeds d
     where d.location_id = a.location_id and d.khatian_no_norm = k.khatian_no_norm and d.dag_no_norm = dg.dag_no_norm
       and d.donor_id = donor.person_id
       and (o.route is distinct from 'baya_deed' or bd.id is null or (d.id <> bd.id and d.deed_date >= bd.deed_date));
    select coalesce(sum(d.area_sold), 0), count(*) filter (where d.donor_id is distinct from donor.person_id)
      into v_all, v_other from ref.deeds d
     where d.location_id = a.location_id and d.khatian_no_norm = k.khatian_no_norm and d.dag_no_norm = dg.dag_no_norm;

    select jsonb_build_object(
      'donor_sales', coalesce((select jsonb_agg(jsonb_build_object('deed_no', d.deed_no, 'deed_date', d.deed_date, 'deed_type', d.deed_type,
                       'area_sold', d.area_sold, 'donee_name', n.name_bn, 'sub_office', d.sub_office) order by d.deed_date)
                 from ref.deeds d left join ref.nid_persons n on n.id = d.donee_id
                where d.location_id = a.location_id and d.khatian_no_norm = k.khatian_no_norm and d.dag_no_norm = dg.dag_no_norm and d.donor_id = donor.person_id), '[]'::jsonb),
      'other_deeds', coalesce((select jsonb_agg(jsonb_build_object('deed_no', d.deed_no, 'deed_date', d.deed_date, 'deed_type', d.deed_type,
                       'area_sold', d.area_sold, 'donor_name', dn.name_bn, 'donee_name', n.name_bn) order by d.deed_date)
                 from ref.deeds d left join ref.nid_persons n on n.id = d.donee_id left join ref.nid_persons dn on dn.id = d.donor_id
                where d.location_id = a.location_id and d.khatian_no_norm = k.khatian_no_norm and d.dag_no_norm = dg.dag_no_norm and d.donor_id is distinct from donor.person_id), '[]'::jsonb),
      'purchases', coalesce((select jsonb_agg(jsonb_build_object('deed_no', d.deed_no, 'deed_date', d.deed_date, 'area_sold', d.area_sold) order by d.deed_date)
                 from ref.deeds d
                where d.location_id = a.location_id and d.khatian_no_norm = k.khatian_no_norm and d.dag_no_norm = dg.dag_no_norm and d.donee_id = donor.person_id), '[]'::jsonb))
      into v_hist;

    select coalesce(jsonb_agg(jsonb_build_object('record_type', g.record_type, 'dag_no', g.dag_no, 'area', g.area, 'agency', g.agency, 'reference_note', g.reference_note) order by g.dag_no_norm), '[]'::jsonb)
      into v_khas from ref.khas_govt g
     where g.location_id = a.location_id and g.khatian_no_norm = k.khatian_no_norm and g.dag_no_norm = dg.dag_no_norm;

    v_rem := case when v_ent is null then null else v_ent - v_sold end;
    update public.application_plots set
      dag_no = dg.dag_no, dag_area = dg.area, recorded_land_class = dg.land_class,
      entitled = round(v_ent, 4), already_sold = round(v_sold, 4), remaining = round(v_rem, 4),
      after_sale = case when v_rem is not null and pl.area_sold is not null then round(v_rem - pl.area_sold, 4) end,
      all_sold_total = round(v_all, 4), other_deeds_count = v_other, khas_matches = v_khas, history = v_hist, assumptions = v_assume
     where id = pl.id;

    if pl.area_sold is null then v_blockers := v_blockers || app.blocker('PLOT_AREA_MISSING', 4, 'দাগ ' || dg.dag_no || ': বিক্রির পরিমাণ দিন', 'Dag ' || dg.dag_no || ': enter the area to sell'); end if;
    if pl.area_sold is not null and pl.area_sold - dg.area > TOL then
      v_blockers := v_blockers || app.blocker('AREA_EXCEEDS_DAG', 4, 'দাগ ' || dg.dag_no || ': বিক্রির পরিমাণ দাগের মোট জমির বেশি', 'Dag ' || dg.dag_no || ': area exceeds the dag total');
    end if;
    if pl.area_sold is not null and v_rem is not null and pl.area_sold - v_rem > TOL then
      v_blockers := v_blockers || app.blocker('EXCEEDS_REMAINING', 4, 'দাগ ' || dg.dag_no || ': বিক্রির পরিমাণ অবশিষ্ট জমির (' || round(v_rem, 4) || ' শতক) বেশি',
                                          'Dag ' || dg.dag_no || ': area exceeds the remaining entitlement (' || round(v_rem, 4) || ')');
    end if;
    if v_ent is null then
      v_flags := v_flags || app.flag('ENTITLEMENT_UNKNOWN', 'unknown', 'দাগ ' || dg.dag_no || ': প্রাপ্য অংশ নির্ণয় করা যায়নি', 'Dag ' || dg.dag_no || ': entitlement could not be computed', 'The over-sale check was not possible; reviewer must decide.', 'computed (assumption-based)');
    elsif v_sold - v_ent > TOL then
      v_flags := v_flags || app.flag('DONOR_ALREADY_OVER', 'high', 'দাগ ' || dg.dag_no || ': দাতা প্রাপ্য অংশের বেশি বিক্রি করেছেন বলে রেকর্ড', 'Dag ' || dg.dag_no || ': donor recorded sales exceed computed entitlement', 'Entitled ' || round(v_ent, 4) || ', sold ' || round(v_sold, 4) || ' শতক.', 'computed (assumption-based)');
    end if;
    if v_all - dg.area > TOL then
      v_flags := v_flags || app.flag('DAG_OVERSOLD', 'high', 'দাগ ' || dg.dag_no || ': মোট বিক্রয় রেকর্ড দাগের পরিমাণের বেশি', 'Dag ' || dg.dag_no || ': recorded sales exceed the dag area', 'Sold ' || round(v_all, 4) || ' vs ' || dg.area || ' শতক.', 'ref.deeds / ref.khatian_dags');
    end if;
    if v_other > 0 then
      v_flags := v_flags || app.flag('OTHER_DONOR_DEEDS', 'medium', 'দাগ ' || dg.dag_no || ': অন্য দাতার দলিল আছে', 'Dag ' || dg.dag_no || ': deeds by other donors exist', 'Not fraud by itself; check boundaries, shares and the baya chain.', 'ref.deeds');
    end if;
    if pl.land_class is null then
      v_blockers := v_blockers || app.blocker('CLASS_MISSING', 5, 'দাগ ' || dg.dag_no || ': জমির শ্রেণি নির্বাচন করুন', 'Dag ' || dg.dag_no || ': select the land class');
    elsif dg.land_class is not null and pl.land_class <> dg.land_class then
      v_flags := v_flags || app.flag('LAND_CLASS_DIFFERS', 'medium', 'দাগ ' || dg.dag_no || ': নির্বাচিত শ্রেণি পর্চার শ্রেণি থেকে ভিন্ন', 'Dag ' || dg.dag_no || ': chosen class differs from the recorded class', 'Chosen ' || pl.land_class || ' vs recorded ' || dg.land_class, 'ref.khatian_dags');
    end if;
    if jsonb_array_length(v_khas) > 0 then
      any_khas := true;
      v_flags := v_flags || app.flag('GOVT_INTEREST_MATCH', 'high', 'দাগ ' || dg.dag_no || ': সরকারি স্বার্থের রেকর্ড পাওয়া গেছে — আটকে রাখুন', 'Dag ' || dg.dag_no || ': government-interest record found; hold for review',
                         (select string_agg(m->>'record_type' || coalesce(' (' || (m->>'agency') || ')', ''), '; ') from jsonb_array_elements(v_khas) m), 'ref.khas_govt');
    end if;
  end loop;
  if n_plots = 0 and a.khatian_id is not null then v_blockers := v_blockers || app.blocker('PLOT_MISSING', 4, 'অন্তত একটি দাগ নির্বাচন করুন', 'Select at least one dag'); end if;
  if n_plots > 0 and not any_khas then
    v_flags := v_flags || app.flag('GOVT_NO_RECORD', 'unknown', 'সরবরাহকৃত ডেটাবেজে কোনো সরকারি স্বার্থের রেকর্ড পাওয়া যায়নি', 'No record in the supplied database. This is NOT clearance.', 'Absence of a record does not prove there is no government interest.', 'ref.khas_govt');
  end if;

  -- 5. price and fees -----------------------------------------------------------
  delete from public.application_fee_items where application_id = p_app;
  if a.sale_price is null then
    v_blockers := v_blockers || app.blocker('PRICE_MISSING', 5, 'প্রস্তাবিত বিক্রয়মূল্য দিন', 'Enter the proposed sale price');
  else
    insert into public.application_fee_items (application_id, fee_code, name_bn, name_en, rate_percent, fixed_amount, min_amount, basis, base_amount, amount, challan_type, is_demo)
    select p_app, c.fee_code, c.name_bn, c.name_en, c.rate_percent, c.fixed_amount, c.min_amount, c.basis, a.sale_price,
           greatest(round(a.sale_price * c.rate_percent / 100 + c.fixed_amount, 2), c.min_amount), c.challan_type, c.is_demo
      from public.fee_config c where c.active;
    if exists (select 1 from public.fee_config c where c.active and c.is_demo) then
      v_flags := v_flags || app.flag('FEE_DEMO_RATES', 'info', 'ফি-এর হার ডেমো/কনফিগারযোগ্য', 'Fees use DEMO rates, not official government rates', 'Confirm official rates before production.', 'public.fee_config');
    end if;
  end if;
  select coalesce(sum(amount), 0) into fee_sum from public.application_fee_items where application_id = p_app;

  -- 6. challans: drop any that no longer match (price changed, record changed) ----
  for ch in select * from public.application_challans where application_id = p_app loop
    select coalesce(sum(amount), 0) into due from public.application_fee_items where application_id = p_app and challan_type = ch.challan_type;
    select * into rc from ref.echallans x where x.challan_no_norm = ch.challan_no_norm;
    if due <> ch.amount or not found or rc.amount <> ch.amount or rc.fee_type <> ch.challan_type or rc.verify_status <> 'verified'
       or (rc.used_in_application_no is not null and rc.used_in_application_no <> a.application_no) then
      delete from public.application_challans where id = ch.id;
      v_flags := v_flags || app.flag('CHALLAN_RESET', 'medium', 'একটি চালানের যাচাই বাতিল হয়েছে — আবার যাচাই করুন', 'A challan verification was reset (amount due or record changed)', ch.challan_type, 'public.application_challans');
    end if;
  end loop;
  for t in select challan_type, sum(amount) as due from public.application_fee_items where application_id = p_app group by challan_type having sum(amount) > 0 loop
    if not exists (select 1 from public.application_challans c where c.application_id = p_app and c.challan_type = t.challan_type) then
      v_blockers := v_blockers || app.blocker('CHALLAN_MISSING_' || upper(t.challan_type), 6, t.challan_type || ' চালান যাচাই করুন', 'Verify the ' || t.challan_type || ' challan');
    end if;
  end loop;

  -- 7. appointment (booking only; NOT biometric completion) ----------------------
  select * into appt from public.application_appointments where application_id = p_app and status in ('booked', 'confirmed');
  if appt.id is null then
    v_blockers := v_blockers || app.blocker('APPOINTMENT_MISSING', 8, 'বায়োমেট্রিকের জন্য তারিখ বুক করুন', 'Book the biometric visit date');
  elsif appt.appt_date <= app.today_bd() then
    v_blockers := v_blockers || app.blocker('APPOINTMENT_PAST', 8, 'বুক করা তারিখ পার হয়ে গেছে, নতুন তারিখ নিন', 'The booked date has passed; book a new date');
  end if;
  select count(*) into n_docs from public.application_documents where application_id = p_app;
  if n_docs = 0 then
    v_flags := v_flags || app.flag('NO_SUPPORTING_DOCS', 'info', 'কোনো সহায়ক নথি সংযুক্ত নেই', 'No supporting documents attached', 'Optional in Stage 2; the reviewer may ask for them.', 'public.application_documents');
  end if;

  update public.deed_applications set flags = v_flags, blockers = v_blockers, fee_total = fee_sum, flags_evaluated_at = now() where id = p_app;
  return jsonb_build_object('flags', v_flags, 'blockers', v_blockers);
end $$;

-- ---------------------------------------------------------------------
-- VIEW: one aggregate JSON document for the owner's UI (read-only).
-- ---------------------------------------------------------------------
create or replace function app.view(p_app uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.deed_applications%rowtype; kh jsonb := null; res jsonb;
begin
  select * into a from public.deed_applications where id = p_app;
  if a.khatian_id is not null then
    select jsonb_build_object(
      'owners', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'serial', o.serial, 'owner_name', o.owner_name, 'father_name', o.father_name, 'share', o.share) order by o.serial) from ref.khatian_owners o where o.khatian_id = a.khatian_id), '[]'::jsonb),
      'dags',   coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'serial', d.serial, 'dag_no', d.dag_no, 'land_class', d.land_class, 'area', d.area) order by d.serial) from ref.khatian_dags d where d.khatian_id = a.khatian_id), '[]'::jsonb),
      'share_total', (select coalesce(sum(share), 0) from ref.khatian_owners where khatian_id = a.khatian_id)) into kh;
  end if;
  select jsonb_build_object(
    'application', to_jsonb(a),
    'khatian', kh,
    'parties', coalesce((select jsonb_agg(to_jsonb(p) - 'application_id' - 'person_id') from public.application_parties p where p.application_id = a.id), '[]'::jsonb),
    'ownership', (select to_jsonb(o) - 'application_id' - 'baya_deed_id' from public.application_ownership o where o.application_id = a.id),
    'plots', coalesce((select jsonb_agg(to_jsonb(x) - 'application_id' order by x.created_at) from public.application_plots x where x.application_id = a.id), '[]'::jsonb),
    'fee_items', coalesce((select jsonb_agg(to_jsonb(f) - 'application_id' order by f.fee_code) from public.application_fee_items f where f.application_id = a.id), '[]'::jsonb),
    'challans', coalesce((select jsonb_agg(to_jsonb(c) - 'application_id' - 'challan_no_norm') from public.application_challans c where c.application_id = a.id), '[]'::jsonb),
    'appointment', (select to_jsonb(ap) - 'application_id' from public.application_appointments ap where ap.application_id = a.id and ap.status in ('booked', 'confirmed')),
    'appointment_events', coalesce((select jsonb_agg(jsonb_build_object('event', e.event, 'detail', e.detail, 'created_at', e.created_at) order by e.id) from public.application_appointment_events e where e.application_id = a.id), '[]'::jsonb),
    'documents', coalesce((select jsonb_agg(to_jsonb(d) - 'application_id' order by d.created_at) from public.application_documents d where d.application_id = a.id), '[]'::jsonb),
    'history', coalesce((select jsonb_agg(jsonb_build_object('from_status', h.from_status, 'to_status', h.to_status, 'actor_role', h.actor_role, 'note', h.note, 'created_at', h.created_at) order by h.id) from public.application_status_history h where h.application_id = a.id), '[]'::jsonb),
    'corrections', coalesce((select jsonb_agg(to_jsonb(c) - 'application_id' - 'requested_by' order by c.requested_at) from public.application_corrections c where c.application_id = a.id), '[]'::jsonb)
  ) into res;
  return res;
end $$;

revoke all on function app.today_bd(), app.flag(text,text,text,text,text,text), app.blocker(text,int,text,text),
  app.name_similarity(text,text), app.assert_applicant(), app.rate_check(uuid,text,int,int), app.load_owned(uuid), app.load_editable(uuid),
  app.notify(uuid,uuid,text,text,text), app.change_status(uuid,text,uuid,text,text), app.recompute(uuid), app.view(uuid)
  from public, anon, authenticated;
