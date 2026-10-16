-- LDIS migration 13: multiple donees, registrar jurisdiction assignment, dashboard user list fields.
-- Apply after migrations 06-12. Review and back up before running.

-- A deed application may contain one donor and up to ten recipients.
alter table public.application_parties drop constraint if exists application_parties_role_check;
alter table public.application_parties
  add constraint application_parties_role_check
  check (role = 'donor' or role = 'donee' or role ~ '^donee_[2-9]$' or role = 'donee_10');

-- Keep one active Sub-Registrar per district/upazila. Resolve any existing duplicates before applying.
do $$
begin
  if exists (
    select 1 from public.profiles
    where role='sub_registrar' and nullif(btrim(district),'') is not null and nullif(btrim(upazila),'') is not null
    group by lower(btrim(district)), lower(btrim(upazila)) having count(*) > 1
  ) then
    raise exception 'Duplicate Sub-Registrar jurisdiction exists. Resolve duplicate district/upazila assignments before applying migration 13.';
  end if;
end $$;

create unique index if not exists profiles_one_sub_registrar_per_upazila
on public.profiles (lower(btrim(district)), lower(btrim(upazila)))
where role='sub_registrar' and nullif(btrim(district),'') is not null and nullif(btrim(upazila),'') is not null;

-- Include jurisdiction in the list shown in Admin > User Approval.
create or replace function public.admin_list_users()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_role text; v_approved boolean; v_result jsonb;
begin
  select p.role,p.is_approved into v_role,v_approved from public.profiles p where p.id=auth.uid();
  if v_role is distinct from 'admin' or v_approved is distinct from true then
    raise exception 'admin access required' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'email',p.email,'full_name',p.full_name,'role',p.role,
    'is_approved',p.is_approved,'district',p.district,'upazila',p.upazila,'created_at',p.created_at
  ) order by p.is_approved asc,p.created_at desc),'[]'::jsonb)
  into v_result from public.profiles p;
  return v_result;
end $$;

-- Admins may assign/transfer jurisdiction only for an existing Sub-Registrar.
-- Role changes remain governed by admin_set_user_access (Super Admin-only for role assignment).
create or replace function public.admin_set_sub_registrar_jurisdiction(
  p_user_id uuid, p_district text, p_upazila text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_role text; v_approved boolean; v_target_role text; v_old_district text; v_old_upazila text;
begin
  select role,is_approved into v_role,v_approved from public.profiles where id=auth.uid();
  if v_role is distinct from 'admin' or v_approved is distinct from true then
    raise exception 'admin access required' using errcode='42501';
  end if;
  if nullif(btrim(p_district),'') is null or nullif(btrim(p_upazila),'') is null then
    raise exception 'district and upazila are required' using errcode='22023';
  end if;
  select role,district,upazila into v_target_role,v_old_district,v_old_upazila
  from public.profiles where id=p_user_id for update;
  if not found then raise exception 'user profile not found' using errcode='P0002'; end if;
  if v_target_role is distinct from 'sub_registrar' then
    raise exception 'jurisdiction can only be assigned to a Sub-Registrar' using errcode='22023';
  end if;
  if not exists (
    select 1 from ref.locations l
    where lower(btrim(l.district))=lower(btrim(p_district))
      and lower(btrim(l.upazila))=lower(btrim(p_upazila))
  ) then raise exception 'selected district/upazila is not present in the reference locations' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtext(lower(btrim(p_district))||'/'||lower(btrim(p_upazila))));
  if exists (
    select 1 from public.profiles p where p.id<>p_user_id and p.role='sub_registrar'
      and lower(btrim(p.district))=lower(btrim(p_district))
      and lower(btrim(p.upazila))=lower(btrim(p_upazila))
  ) then raise exception 'this upazila is already assigned to another Sub-Registrar' using errcode='AP001'; end if;
  update public.profiles set district=btrim(p_district),upazila=btrim(p_upazila) where id=p_user_id;
  insert into public.audit_logs(actor_id,actor_role,action,details)
  values(auth.uid(),'admin','sub_registrar_jurisdiction_updated',
    jsonb_build_object('target_user_id',p_user_id,'old_district',v_old_district,'old_upazila',v_old_upazila,
      'district',btrim(p_district),'upazila',btrim(p_upazila)));
  return jsonb_build_object('ok',true,'user_id',p_user_id,'district',btrim(p_district),'upazila',btrim(p_upazila));
end $$;

revoke all on function public.admin_list_users() from public,anon;
revoke all on function public.admin_set_sub_registrar_jurisdiction(uuid,text,text) from public,anon;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_set_sub_registrar_jurisdiction(uuid,text,text) to authenticated;

-- Allow recipient roles donee, donee_2 ... donee_10 in the existing application-party RPC.
create or replace function public.app_set_party(p_app uuid, p_role text, p_nid text, p_dob date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.deed_applications%rowtype; v jsonb; per jsonb;
begin
  a := app.load_editable(p_app);
  if p_role is null or not (p_role in ('donor','donee') or p_role ~ '^donee_[2-9]$' or p_role='donee_10') then
    raise exception 'invalid role' using errcode='22023';
  end if;
  perform app.rate_check(a.applicant_id,'nid',30,10);
  v := public.verify_nid(p_nid,p_dob);
  if not coalesce((v->>'found')::boolean,false) then
    return jsonb_build_object('ok',false,'found',false);
  end if;
  per := v->'person';
  if exists (
    select 1 from public.application_parties x
    where x.application_id=p_app and x.role<>p_role and x.person_id=(per->>'id')::uuid
  ) then raise exception 'The same person cannot be entered as donor and/or multiple recipients.' using errcode='AP001'; end if;
  insert into public.application_parties
    (application_id,role,person_id,nid_masked,name_bn,father_name,mother_name,dob,gender,address,occupation,attestation_count)
  values
    (p_app,p_role,(per->>'id')::uuid,per->>'nid_masked',per->>'name_bn',per->>'father_name',per->>'mother_name',
     (per->>'dob')::date,per->>'gender',per->>'address',per->>'occupation',jsonb_array_length(v->'attestations'))
  on conflict (application_id,role) do update set
    person_id=excluded.person_id,nid_masked=excluded.nid_masked,name_bn=excluded.name_bn,
    father_name=excluded.father_name,mother_name=excluded.mother_name,dob=excluded.dob,gender=excluded.gender,
    address=excluded.address,occupation=excluded.occupation,attestation_count=excluded.attestation_count,verified_at=now();
  perform app.recompute(p_app);
  return jsonb_build_object('ok',true,'found',true,'attestations',v->'attestations','application',app.view(p_app));
end $$;

revoke all on function public.app_set_party(uuid,text,text,date) from public,anon;
grant execute on function public.app_set_party(uuid,text,text,date) to authenticated;
