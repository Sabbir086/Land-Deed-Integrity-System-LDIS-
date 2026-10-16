-- LDIS migration 12: Super Admin lock, staff-only direct lookups, optional lookup dates.
-- Apply after migrations 06-11. This is additive and does not alter ref.* data.

-- Provision the designated Super Admin by email. The account must already exist.
update public.profiles p
set role = 'admin', is_approved = true, full_name = 'Sabbir Hosen Joy',
    approved_at = coalesce(p.approved_at, now())
where lower(p.email) = lower('joysabbir086@gmail.com');

create or replace function public.admin_set_user_access(p_user_id uuid, p_role text, p_approved boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor_role text; v_actor_approved boolean; v_actor_email text;
  v_target_email text; v_target_role text; v_target_approved boolean;
  v_is_super boolean;
begin
  select p.role, p.is_approved, lower(u.email)
    into v_actor_role, v_actor_approved, v_actor_email
  from public.profiles p join auth.users u on u.id=p.id
  where p.id=auth.uid();

  if v_actor_role is distinct from 'admin' or v_actor_approved is distinct from true then
    raise exception 'admin access required' using errcode='42501';
  end if;
  v_is_super := v_actor_email = lower('joysabbir086@gmail.com');

  select lower(email), role, is_approved into v_target_email, v_target_role, v_target_approved
  from public.profiles where id=p_user_id;
  if not found then raise exception 'user profile not found' using errcode='P0002'; end if;

  if v_target_email = lower('joysabbir086@gmail.com') then
    if p_role <> 'admin' or p_approved is distinct from true then
      raise exception 'Super Admin role and approval are locked' using errcode='42501';
    end if;
  end if;

  if p_role not in ('user','sub_registrar','admin') then
    raise exception 'invalid role' using errcode='22023';
  end if;

  if not v_is_super then
    -- Other admins may approve/revoke User and Sub-Registrar accounts, but
    -- cannot assign/change roles or grant/revoke Admin access.
    if p_role is distinct from v_target_role or v_target_role='admin' then
      raise exception 'only Super Admin can change roles or manage Admin accounts' using errcode='42501';
    end if;
  end if;

  update public.profiles
  set role=p_role,
      is_approved=p_approved,
      approved_at=case when p_approved then coalesce(approved_at,now()) else null end,
      approved_by=case when p_approved then auth.uid() else null end
  where id=p_user_id;

  insert into public.audit_logs(actor_id,actor_role,action,details)
  values(auth.uid(),v_actor_role,'user_access_updated',
    jsonb_build_object('target_user_id',p_user_id,'role',p_role,'is_approved',p_approved));
  return jsonb_build_object('ok',true,'user_id',p_user_id,'role',p_role,'is_approved',p_approved);
end;
$$;

-- Optional date: if omitted, return all matching deed-number records.
create or replace function public.verify_deed(p_deed_no text, p_deed_date date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_role text; n text; res jsonb; other_dates integer;
begin
  v_role := ref.assert_app_user();
  n := ref.bn2en(p_deed_no);
  if n !~ '^[0-9]{1,6}(/[0-9]{4})?$' then
    raise exception 'invalid input' using errcode='22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'deed_no',d.deed_no,'deed_date',d.deed_date,'deed_type',d.deed_type,
    'division',l.division,'district',l.district,'upazila',l.upazila,'mouza',l.mouza,
    'khatian_no',d.khatian_no,'dag_no',d.dag_no,'area_sold',d.area_sold,
    'donor_name',dd.name_bn,'donee_name',dn.name_bn,'sub_office',d.sub_office,
    'registered_on',d.registered_on,'prev_deed_no',pd.deed_no,'prev_deed_date',pd.deed_date)
    order by d.deed_date),'[]'::jsonb)
  into res
  from ref.deeds d
  left join ref.locations l on l.id=d.location_id
  left join ref.nid_persons dd on dd.id=d.donor_id
  left join ref.nid_persons dn on dn.id=d.donee_id
  left join ref.deeds pd on pd.id=d.prev_deed_id
  where d.deed_no_norm=n and (p_deed_date is null or d.deed_date=p_deed_date);
  select count(*) into other_dates from ref.deeds d
  where d.deed_no_norm=n and p_deed_date is not null and d.deed_date<>p_deed_date;
  return jsonb_build_object('candidates',res,'same_number_other_dates',other_dates);
end $$;
revoke all on function public.verify_deed(text,date) from public, anon;
grant execute on function public.verify_deed(text,date) to authenticated;

-- Optional DOB for staff NID lookup. Without DOB, return a single match only;
-- if the NID is duplicated in reference data, return found=false to avoid ambiguity.
create or replace function public.verify_nid(p_nid_no text, p_dob date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_role text; n text; p ref.nid_persons%rowtype; att jsonb; v_count integer;
begin
  v_role := ref.assert_app_user();
  n := ref.bn2en(p_nid_no);
  if n is null or n !~ '^[0-9]{10,17}$' then
    raise exception 'invalid input' using errcode='22023';
  end if;
  if p_dob is null then
    select count(*) into v_count from ref.nid_persons x where x.nid_no_norm=n;
    if v_count <> 1 then return jsonb_build_object('found',false); end if;
    select * into p from ref.nid_persons x where x.nid_no_norm=n limit 1;
  else
    select * into p from ref.nid_persons x where x.nid_no_norm=n and x.dob=p_dob;
  end if;
  if not found then return jsonb_build_object('found',false); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'attestation_no',a.attestation_no,'issued_by',a.issued_by,'issue_date',a.issue_date,
    'name_variant_a',a.name_variant_a,'name_variant_b',a.name_variant_b,'note',a.note)
    order by a.issue_date),'[]'::jsonb) into att
  from ref.name_attestations a where a.person_id=p.id;
  return jsonb_build_object('found',true,'person',jsonb_build_object(
    'id',p.id,'nid_masked',repeat('*',greatest(length(p.nid_no_norm)-3,0))||right(p.nid_no_norm,3),
    'name_bn',p.name_bn,'father_name',p.father_name,'mother_name',p.mother_name,
    'dob',p.dob,'gender',p.gender,'address',p.address,'occupation',p.occupation),'attestations',att);
end $$;
revoke all on function public.verify_nid(text,date) from public, anon;
grant execute on function public.verify_nid(text,date) to authenticated;
