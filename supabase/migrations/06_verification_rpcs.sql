-- =====================================================================
-- 06_verification_rpcs.sql  (Stage 1)  -- ADDITIVE ONLY, safe to re-run
-- Narrow, read-only, authenticated-only RPCs over the private ref schema.
--
-- * Does NOT drop/alter/truncate/insert any existing table or row.
-- * Creates only functions (create or replace) + EXECUTE grants.
-- * Every function: SECURITY DEFINER, search_path = '' (all names qualified),
--   explicit authorization via ref.assert_app_user() (role read from
--   public.profiles through auth.uid(), never from client input),
--   input validation, minimal output, EXECUTE only for role `authenticated`.
-- * NOT yet applied to the live database by Stage 1 (no DB access from the
--   build environment). Review, then run once in Supabase SQL Editor.
-- =====================================================================

-- ---------- internal authorization helper (not callable from the API) ----
create or replace function ref.assert_app_user() returns text
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_role text;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select p.role into v_role from public.profiles p where p.id = v_uid;
  if v_role is null or v_role not in ('user','sub_registrar','admin') then
    raise exception 'no valid profile' using errcode = '42501';
  end if;
  return v_role;
end $$;
revoke all on function ref.assert_app_user() from public, anon, authenticated;

-- ---------- 1. location cascade (division > district > upazila > mouza) --
create or replace function public.verify_location_options(
  p_level text, p_division text default null, p_district text default null, p_upazila text default null
) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_role text; res jsonb;
begin
  v_role := ref.assert_app_user();
  if p_level = 'division' then
    select coalesce(jsonb_agg(s.v order by s.v), '[]'::jsonb) into res
      from (select distinct l.division as v from ref.locations l) s;
  elsif p_level = 'district' then
    select coalesce(jsonb_agg(s.v order by s.v), '[]'::jsonb) into res
      from (select distinct l.district as v from ref.locations l where l.division = p_division) s;
  elsif p_level = 'upazila' then
    select coalesce(jsonb_agg(s.v order by s.v), '[]'::jsonb) into res
      from (select distinct l.upazila as v from ref.locations l
             where l.division = p_division and l.district = p_district) s;
  elsif p_level = 'mouza' then
    select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'name', l.mouza) order by l.mouza), '[]'::jsonb) into res
      from ref.locations l
     where l.division = p_division and l.district = p_district and l.upazila = p_upazila;
  else
    raise exception 'invalid level' using errcode = '22023';
  end if;
  return res;
end $$;

-- ---------- 2. khatian types available in a mouza ------------------------
create or replace function public.verify_khatian_types(p_location_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_role text; res jsonb;
begin
  v_role := ref.assert_app_user();
  select coalesce(jsonb_agg(s.t order by s.t), '[]'::jsonb) into res
    from (select distinct k.khatian_type as t from ref.khatians k where k.location_id = p_location_id) s;
  return res;
end $$;

-- ---------- 3. NID / person verification (needs NID no. AND date of birth)
create or replace function public.verify_nid(p_nid_no text, p_dob date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_role text; n text; p ref.nid_persons%rowtype; att jsonb;
begin
  v_role := ref.assert_app_user();
  n := ref.bn2en(p_nid_no);
  if p_dob is null or n is null or n !~ '^[0-9]{10,17}$' then
    raise exception 'invalid input' using errcode = '22023';
  end if;
  select * into p from ref.nid_persons x where x.nid_no_norm = n and x.dob = p_dob;
  if not found then
    -- same answer for "unknown NID" and "wrong date of birth" (no enumeration)
    return jsonb_build_object('found', false);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'attestation_no', a.attestation_no, 'issued_by', a.issued_by, 'issue_date', a.issue_date,
           'name_variant_a', a.name_variant_a, 'name_variant_b', a.name_variant_b, 'note', a.note)
           order by a.issue_date), '[]'::jsonb)
    into att from ref.name_attestations a where a.person_id = p.id;
  return jsonb_build_object('found', true,
    'person', jsonb_build_object(
      'id', p.id, 'nid_masked', repeat('*', greatest(length(p.nid_no_norm) - 3, 0)) || right(p.nid_no_norm, 3),
      'name_bn', p.name_bn, 'father_name', p.father_name, 'mother_name', p.mother_name,
      'dob', p.dob, 'gender', p.gender, 'address', p.address, 'occupation', p.occupation),
    'attestations', att);
end $$;

-- ---------- 4. khatian search: record, owners, dags, shares ---------------
create or replace function public.verify_khatian(p_location_id uuid, p_khatian_type text, p_khatian_no text)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_role text; k ref.khatians%rowtype; loc ref.locations%rowtype; n text;
        owners jsonb; dags jsonb; tot numeric;
begin
  v_role := ref.assert_app_user();
  n := ref.bn2en(p_khatian_no);
  if p_location_id is null or coalesce(btrim(p_khatian_type), '') = '' or n !~ '^[0-9]{1,12}$' then
    raise exception 'invalid input' using errcode = '22023';
  end if;
  select * into k from ref.khatians x
   where x.location_id = p_location_id and x.khatian_type = p_khatian_type and x.khatian_no_norm = n;
  if not found then return jsonb_build_object('found', false); end if;
  select * into loc from ref.locations l where l.id = k.location_id;
  select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'serial', o.serial, 'owner_name', o.owner_name,
           'father_name', o.father_name, 'share', o.share) order by o.serial), '[]'::jsonb),
         coalesce(sum(o.share), 0)
    into owners, tot from ref.khatian_owners o where o.khatian_id = k.id;
  select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'serial', d.serial, 'dag_no', d.dag_no,
           'land_class', d.land_class, 'area', d.area) order by d.serial), '[]'::jsonb)
    into dags from ref.khatian_dags d where d.khatian_id = k.id;
  return jsonb_build_object('found', true,
    'khatian', jsonb_build_object('id', k.id, 'khatian_type', k.khatian_type, 'khatian_no', k.khatian_no,
       'location_id', loc.id, 'division', loc.division, 'district', loc.district,
       'upazila', loc.upazila, 'mouza', loc.mouza),
    'owners', owners, 'dags', dags, 'share_total', tot,
    'share_status', case when abs(tot - 1) < 0.0005 then 'OK' else 'CHECK' end);
end $$;

-- ---------- 5. porcha owner vs NID person: raw strings for name matching --
create or replace function public.verify_owner_identity(p_owner_id uuid, p_nid_no text, p_dob date)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_role text; o ref.khatian_owners%rowtype; p ref.nid_persons%rowtype; n text; att jsonb;
begin
  v_role := ref.assert_app_user();
  n := ref.bn2en(p_nid_no);
  if p_owner_id is null or p_dob is null or n !~ '^[0-9]{10,17}$' then
    raise exception 'invalid input' using errcode = '22023';
  end if;
  select * into o from ref.khatian_owners x where x.id = p_owner_id;
  if not found then return jsonb_build_object('found', false, 'reason', 'owner_not_found'); end if;
  select * into p from ref.nid_persons x where x.nid_no_norm = n and x.dob = p_dob;
  if not found then return jsonb_build_object('found', false, 'reason', 'person_not_found'); end if;
  select coalesce(jsonb_agg(jsonb_build_object('attestation_no', a.attestation_no, 'issued_by', a.issued_by,
           'name_variant_a', a.name_variant_a, 'name_variant_b', a.name_variant_b) order by a.issue_date), '[]'::jsonb)
    into att from ref.name_attestations a where a.person_id = p.id;
  return jsonb_build_object('found', true,
    'owner',  jsonb_build_object('id', o.id, 'name', o.owner_name, 'father_name', o.father_name, 'share', o.share),
    'person', jsonb_build_object('id', p.id, 'name', p.name_bn, 'father_name', p.father_name),
    'attestations', att);
end $$;

-- ---------- 6. dag history: earlier sales + remaining-land inputs ---------
create or replace function public.verify_dag_history(p_khatian_id uuid, p_dag_id uuid, p_nid_no text, p_dob date, p_owner_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_role text; k ref.khatians%rowtype; dg ref.khatian_dags%rowtype; p ref.nid_persons%rowtype; n text;
        o ref.khatian_owners%rowtype; own_sales jsonb; other_deeds jsonb; bought jsonb; sold_own numeric; sold_all numeric;
begin
  v_role := ref.assert_app_user();
  n := ref.bn2en(p_nid_no);
  if p_khatian_id is null or p_dag_id is null or p_dob is null or n !~ '^[0-9]{10,17}$' then
    raise exception 'invalid input' using errcode = '22023';
  end if;
  select * into k from ref.khatians x where x.id = p_khatian_id;
  select * into dg from ref.khatian_dags x where x.id = p_dag_id and x.khatian_id = p_khatian_id;
  if k.id is null or dg.id is null then return jsonb_build_object('found', false, 'reason', 'dag_not_found'); end if;
  select * into p from ref.nid_persons x where x.nid_no_norm = n and x.dob = p_dob;
  if not found then return jsonb_build_object('found', false, 'reason', 'person_not_found'); end if;
  if p_owner_id is not null then   -- owner must belong to THIS khatian
    select * into o from ref.khatian_owners x where x.id = p_owner_id and x.khatian_id = k.id;
  end if;

  -- LEFT panel: earlier sales by the current donor on this dag
  select coalesce(jsonb_agg(jsonb_build_object('deed_no', d.deed_no, 'deed_date', d.deed_date,
           'deed_type', d.deed_type, 'area_sold', d.area_sold, 'donee_name', dn.name_bn,
           'prev_deed_no', pd.deed_no, 'sub_office', d.sub_office, 'registered_on', d.registered_on)
           order by d.deed_date), '[]'::jsonb),
         coalesce(sum(d.area_sold), 0)
    into own_sales, sold_own
    from ref.deeds d
    left join ref.nid_persons dn on dn.id = d.donee_id
    left join ref.deeds pd on pd.id = d.prev_deed_id
   where d.location_id = k.location_id and d.khatian_no_norm = k.khatian_no_norm
     and d.dag_no_norm = dg.dag_no_norm and d.donor_id = p.id;

  -- RIGHT panel: deeds on the same dag by OTHER donors
  select coalesce(jsonb_agg(jsonb_build_object('deed_no', d.deed_no, 'deed_date', d.deed_date,
           'deed_type', d.deed_type, 'area_sold', d.area_sold, 'donor_name', dd.name_bn,
           'donee_name', dn.name_bn, 'prev_deed_no', pd.deed_no) order by d.deed_date), '[]'::jsonb)
    into other_deeds
    from ref.deeds d
    left join ref.nid_persons dd on dd.id = d.donor_id
    left join ref.nid_persons dn on dn.id = d.donee_id
    left join ref.deeds pd on pd.id = d.prev_deed_id
   where d.location_id = k.location_id and d.khatian_no_norm = k.khatian_no_norm
     and d.dag_no_norm = dg.dag_no_norm and d.donor_id is distinct from p.id;

  -- deeds where this person BOUGHT land on the dag (not used in entitlement: rule unresolved)
  select coalesce(jsonb_agg(jsonb_build_object('deed_no', d.deed_no, 'deed_date', d.deed_date,
           'area_sold', d.area_sold) order by d.deed_date), '[]'::jsonb)
    into bought
    from ref.deeds d
   where d.location_id = k.location_id and d.khatian_no_norm = k.khatian_no_norm
     and d.dag_no_norm = dg.dag_no_norm and d.donee_id = p.id;

  select coalesce(sum(d.area_sold), 0) into sold_all from ref.deeds d
   where d.location_id = k.location_id and d.khatian_no_norm = k.khatian_no_norm and d.dag_no_norm = dg.dag_no_norm;

  return jsonb_build_object('found', true,
    'dag', jsonb_build_object('id', dg.id, 'dag_no', dg.dag_no, 'land_class', dg.land_class, 'area', dg.area),
    'donor_previous_sales', own_sales, 'donor_sold_total', sold_own,
    'other_donor_deeds', other_deeds, 'donor_purchases', bought,
    'all_sold_total_on_dag', sold_all, 'owner_share', o.share);
end $$;

-- ---------- 7. khas / government-interest check ---------------------------
-- Exact match on location + khatian + dag (normalised). NO MATCH IS NOT CLEARANCE.
create or replace function public.verify_khas(p_location_id uuid, p_khatian_no text, p_dag_nos text[])
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_role text; kn text; dn text[]; res jsonb;
begin
  v_role := ref.assert_app_user();
  kn := ref.bn2en(p_khatian_no);
  if p_location_id is null or kn !~ '^[0-9]{1,12}$'
     or p_dag_nos is null or coalesce(array_length(p_dag_nos, 1), 0) not between 1 and 10 then
    raise exception 'invalid input' using errcode = '22023';
  end if;
  dn := array(select ref.bn2en(x) from unnest(p_dag_nos) x);
  select coalesce(jsonb_agg(jsonb_build_object('record_type', g.record_type, 'khatian_no', g.khatian_no,
           'dag_no', g.dag_no, 'area', g.area, 'agency', g.agency, 'reference_note', g.reference_note)
           order by g.dag_no_norm), '[]'::jsonb)
    into res
    from ref.khas_govt g
   where g.location_id = p_location_id and g.khatian_no_norm = kn and g.dag_no_norm = any(dn);
  return jsonb_build_object('matches', res, 'checked_dags', to_jsonb(dn),
                            'no_match_is_not_clearance', true);
end $$;

-- ---------- 8. deed lookup by number + date -------------------------------
create or replace function public.verify_deed(p_deed_no text, p_deed_date date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_role text; n text; res jsonb; other_dates integer;
begin
  v_role := ref.assert_app_user();
  n := ref.bn2en(p_deed_no);
  if p_deed_date is null or n !~ '^[0-9]{1,6}(/[0-9]{4})?$' then
    raise exception 'invalid input' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'deed_no', d.deed_no, 'deed_date', d.deed_date, 'deed_type', d.deed_type,
           'division', l.division, 'district', l.district, 'upazila', l.upazila, 'mouza', l.mouza,
           'khatian_no', d.khatian_no, 'dag_no', d.dag_no, 'area_sold', d.area_sold,
           'donor_name', dd.name_bn, 'donee_name', dn.name_bn,
           'sub_office', d.sub_office, 'registered_on', d.registered_on,
           'prev_deed_no', pd.deed_no, 'prev_deed_date', pd.deed_date) order by d.deed_date), '[]'::jsonb)
    into res
    from ref.deeds d
    left join ref.locations l on l.id = d.location_id
    left join ref.nid_persons dd on dd.id = d.donor_id
    left join ref.nid_persons dn on dn.id = d.donee_id
    left join ref.deeds pd on pd.id = d.prev_deed_id
   where d.deed_no_norm = n and d.deed_date = p_deed_date;
  select count(*) into other_dates from ref.deeds d where d.deed_no_norm = n and d.deed_date <> p_deed_date;
  return jsonb_build_object('candidates', res, 'same_number_other_dates', other_dates);
end $$;

-- ---------- 9. warish certificate + heirs ---------------------------------
create or replace function public.verify_warish(p_cert_no text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_role text; c ref.warish_certs%rowtype; heirs jsonb; tot numeric; q text;
begin
  v_role := ref.assert_app_user();
  q := ref.bn2en(p_cert_no);
  if q is null or length(q) not between 1 and 60 then
    raise exception 'invalid input' using errcode = '22023';
  end if;
  select * into c from ref.warish_certs x where ref.bn2en(x.cert_no) = q limit 1;
  if not found then return jsonb_build_object('found', false); end if;
  select coalesce(jsonb_agg(jsonb_build_object('serial', h.serial, 'name', n.name_bn,
           'father_name', n.father_name, 'relation', h.relation, 'share', h.share) order by h.serial), '[]'::jsonb),
         coalesce(sum(h.share), 0)
    into heirs, tot
    from ref.warish_heirs h join ref.nid_persons n on n.id = h.heir_id where h.cert_id = c.id;
  return jsonb_build_object('found', true,
    'certificate', jsonb_build_object('cert_no', c.cert_no, 'cert_date', c.cert_date,
       'deceased_name', c.deceased_name, 'deceased_father_name', c.deceased_father_name,
       'issuing_authority', c.issuing_authority),
    'heirs', heirs, 'share_total', tot,
    'share_status', case when abs(tot - 1) < 0.0005 then 'OK' else 'CHECK' end);
end $$;

-- ---------- 10. e-challan check (read-only; does not mark as used) --------
create or replace function public.verify_challan(p_challan_no text, p_amount numeric, p_fee_type text)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_role text; n text; c ref.echallans%rowtype;
begin
  v_role := ref.assert_app_user();
  n := ref.bn2en(p_challan_no);
  if n is null or n !~ '^[A-Za-z0-9-]{3,40}$' or p_amount is null or p_amount <= 0
     or p_fee_type is null or p_fee_type not in ('stamp','registration','source_tax','other') then
    raise exception 'invalid input' using errcode = '22023';
  end if;
  select * into c from ref.echallans x where x.challan_no_norm = n;
  if not found then return jsonb_build_object('found', false); end if;
  -- recorded amount is deliberately NOT returned (prevents probing); only comparison flags
  return jsonb_build_object('found', true,
    'amount_matches', c.amount = p_amount,
    'fee_type_matches', c.fee_type = p_fee_type,
    'verify_status', c.verify_status,
    'paid_on', c.paid_on,
    'already_linked_to_application', c.used_in_application_no is not null);
end $$;

-- ---------- grants: authenticated only ------------------------------------
revoke all on function public.verify_location_options(text,text,text,text) from public, anon;
revoke all on function public.verify_khatian_types(uuid)                  from public, anon;
revoke all on function public.verify_nid(text,date)                       from public, anon;
revoke all on function public.verify_khatian(uuid,text,text)              from public, anon;
revoke all on function public.verify_owner_identity(uuid,text,date)       from public, anon;
revoke all on function public.verify_dag_history(uuid,uuid,text,date,uuid) from public, anon;
revoke all on function public.verify_khas(uuid,text,text[])               from public, anon;
revoke all on function public.verify_deed(text,date)                      from public, anon;
revoke all on function public.verify_warish(text)                         from public, anon;
revoke all on function public.verify_challan(text,numeric,text)           from public, anon;

grant execute on function public.verify_location_options(text,text,text,text) to authenticated;
grant execute on function public.verify_khatian_types(uuid)                  to authenticated;
grant execute on function public.verify_nid(text,date)                       to authenticated;
grant execute on function public.verify_khatian(uuid,text,text)              to authenticated;
grant execute on function public.verify_owner_identity(uuid,text,date)       to authenticated;
grant execute on function public.verify_dag_history(uuid,uuid,text,date,uuid) to authenticated;
grant execute on function public.verify_khas(uuid,text,text[])               to authenticated;
grant execute on function public.verify_deed(text,date)                      to authenticated;
grant execute on function public.verify_warish(text)                         to authenticated;
grant execute on function public.verify_challan(text,numeric,text)           to authenticated;
