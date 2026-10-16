-- LDIS migration 15: approved Data Entry Operator role and insert-only manual entry.
-- Apply after migrations 11-14. Does not modify or delete existing reference records.

begin;

-- Replace any existing role CHECK constraint on profiles with the supported role list.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.profiles add constraint profiles_role_allowed_check
  check (role in ('user','sub_registrar','admin','data_entry_operator'));

create or replace function public.admin_set_user_access(p_user_id uuid, p_role text, p_approved boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_actor_role text; v_actor_approved boolean; v_actor_email text;
        v_target_email text; v_target_role text; v_is_super boolean;
begin
  select p.role,p.is_approved,lower(u.email) into v_actor_role,v_actor_approved,v_actor_email
  from public.profiles p join auth.users u on u.id=p.id where p.id=auth.uid();
  if v_actor_role is distinct from 'admin' or v_actor_approved is distinct from true then
    raise exception 'admin access required' using errcode='42501';
  end if;
  v_is_super := v_actor_email = lower('joysabbir086@gmail.com');
  select lower(email),role into v_target_email,v_target_role from public.profiles where id=p_user_id;
  if not found then raise exception 'user profile not found' using errcode='P0002'; end if;
  if v_target_email=lower('joysabbir086@gmail.com') and (p_role<>'admin' or p_approved is distinct from true) then
    raise exception 'Super Admin role and approval are locked' using errcode='42501';
  end if;
  if p_role not in ('user','sub_registrar','admin','data_entry_operator') then
    raise exception 'invalid role' using errcode='22023';
  end if;
  if not v_is_super and (p_role is distinct from v_target_role or v_target_role='admin' or p_role='admin') then
    raise exception 'only Super Admin can change roles or manage Admin accounts' using errcode='42501';
  end if;
  update public.profiles set role=p_role,is_approved=p_approved,
    approved_at=case when p_approved then coalesce(approved_at,now()) else null end,
    approved_by=case when p_approved then auth.uid() else null end where id=p_user_id;
  insert into public.audit_logs(actor_id,actor_role,action,details)
  values(auth.uid(),v_actor_role,'user_access_updated',jsonb_build_object('target_user_id',p_user_id,'role',p_role,'is_approved',p_approved));
  return jsonb_build_object('ok',true,'user_id',p_user_id,'role',p_role,'is_approved',p_approved);
end $$;

create or replace function public.data_entry_insert_record(p_table text, p_record jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_role text; v_approved boolean; v_key text; v_value text;
  v_columns text; v_sql text; v_duplicate boolean := false; v_count integer; v_valid integer;
begin
  select role,is_approved into v_role,v_approved from public.profiles where id=auth.uid();
  if v_role is distinct from 'data_entry_operator' or v_approved is distinct from true then
    raise exception 'approved data entry operator required' using errcode='42501';
  end if;
  if p_table not in ('echallans','nid_persons','warish_certs','name_attestations') or
     jsonb_typeof(p_record)<>'object' or p_record='{}'::jsonb then
    raise exception 'invalid table or record' using errcode='22023';
  end if;

  -- Reject duplicates before insertion. These are the natural identifiers used by lookup.
  if p_table='echallans' then v_key:='challan_no_norm'; v_value:=coalesce(p_record->>'challan_no_norm',p_record->>'challan_no');
  elsif p_table='nid_persons' then v_key:='nid_no_norm'; v_value:=p_record->>'nid_no_norm';
  elsif p_table='warish_certs' then v_key:='cert_no'; v_value:=p_record->>'cert_no';
  else v_key:='attestation_no'; v_value:=p_record->>'attestation_no';
  end if;
  if v_value is null or btrim(v_value)='' then raise exception 'required identifier missing' using errcode='22023'; end if;
  execute format('select exists(select 1 from ref.%I where %I::text = $1)',p_table,v_key)
    into v_duplicate using v_value;
  if v_duplicate then raise exception 'DUPLICATE_RECORD' using errcode='23505'; end if;

  select count(*)::integer into v_count from jsonb_object_keys(p_record);
  select count(*)::integer into v_valid from jsonb_object_keys(p_record) as keys(key)
    join information_schema.columns c on c.table_schema='ref' and c.table_name=p_table and c.column_name=keys.key;
  if v_count<>v_valid then raise exception 'unknown field for selected table' using errcode='22023'; end if;

  -- Canonical normalized lookup fields are populated by the server.
  if p_table='echallans' then
    p_record := p_record || jsonb_build_object('challan_no_norm',regexp_replace(coalesce(p_record->>'challan_no_norm',p_record->>'challan_no'),'[^A-Za-z0-9-]','','g'));
  elsif p_table='nid_persons' then
    p_record := p_record || jsonb_build_object('nid_no_norm',regexp_replace(p_record->>'nid_no_norm','[^0-9]','','g'));
  end if;
  select string_agg(format('%I',keys.key),', ' order by keys.key) into v_columns from jsonb_object_keys(p_record) as keys(key);
  select count(*)::integer into v_valid from jsonb_object_keys(p_record) as keys(key)
    join information_schema.columns c on c.table_schema='ref' and c.table_name=p_table and c.column_name=keys.key;
  select count(*)::integer into v_count from jsonb_object_keys(p_record);
  if v_count<>v_valid then raise exception 'unknown field for selected table' using errcode='22023'; end if;
  v_sql:=format('insert into ref.%I (%s) select %s from jsonb_populate_record(null::ref.%I,$1)',
    p_table,v_columns,v_columns,p_table);
  execute v_sql using p_record;
  insert into public.audit_logs(actor_id,actor_role,action,details)
  values(auth.uid(),'data_entry_operator','manual_reference_insert',jsonb_build_object('table',p_table,'identifier',v_value));
  return jsonb_build_object('inserted',true,'table',p_table,'identifier',v_value);
end $$;

revoke all on function public.data_entry_insert_record(text,jsonb) from public,anon;
grant execute on function public.data_entry_insert_record(text,jsonb) to authenticated;

commit;
