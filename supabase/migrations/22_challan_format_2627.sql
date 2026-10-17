-- LDIS migration 22: change challan number format to 2627-10001, 2627-10002, ... .
-- Apply after migration 20/21, including if migration 20's earlier format was already installed.
-- The 10000 starting offset reserves 10001..10100 for the supplied CSV demo set.
begin;

alter table public.challan_number_counter drop constraint if exists challan_number_counter_fiscal_code_check;
alter table public.challan_number_counter add constraint challan_number_counter_fiscal_code_check check(fiscal_code ~ '^[0-9]{4}$');
update public.challan_number_counter set fiscal_code='2627', office_code='1', last_number=10000 where id=true;

create or replace function public.data_entry_insert_record(p_table text, p_record jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_role text; v_approved boolean; v_key text; v_value text;
  v_columns text; v_sql text; v_duplicate boolean := false; v_count integer; v_valid integer;
  v_fiscal_code text; v_serial integer;
begin
  select role,is_approved into v_role,v_approved from public.profiles where id=auth.uid();
  if v_role is distinct from 'data_entry_operator' or v_approved is distinct from true then
    raise exception 'approved data entry operator required' using errcode='42501';
  end if;
  if p_table not in ('echallans','nid_persons','warish_certs','name_attestations') or
     jsonb_typeof(p_record)<>'object' or p_record='{}'::jsonb then
    raise exception 'invalid table or record' using errcode='22023';
  end if;

  if p_table='echallans' then
    -- New fixed format: 2627-10001, 2627-10002, ... . The row lock prevents duplicate serials.
    update public.challan_number_counter
      set last_number=last_number+1
      where id=true
      returning fiscal_code,last_number into v_fiscal_code,v_serial;
    if not found then raise exception 'challan number counter is not configured' using errcode='55000'; end if;
    v_value:=v_fiscal_code||'-'||lpad(v_serial::text,5,'0');
    p_record := (p_record - 'challan_no' - 'challan_no_norm') || jsonb_build_object(
      'challan_no',v_value,
      'challan_no_norm',v_value,
      'verify_status',coalesce(p_record->>'verify_status','verified')
    );
    v_key:='challan_no_norm';
  elsif p_table='nid_persons' then
    v_key:='nid_no_norm'; v_value:=p_record->>'nid_no_norm';
  elsif p_table='warish_certs' then
    v_key:='cert_no'; v_value:=p_record->>'cert_no';
  else
    v_key:='attestation_no'; v_value:=p_record->>'attestation_no';
  end if;
  if v_value is null or btrim(v_value)='' then raise exception 'required identifier missing' using errcode='22023'; end if;
  execute format('select exists(select 1 from ref.%I where %I::text = $1)',p_table,v_key)
    into v_duplicate using v_value;
  if v_duplicate then raise exception 'DUPLICATE_RECORD' using errcode='23505'; end if;

  if p_table='nid_persons' then
    p_record := p_record || jsonb_build_object('nid_no_norm',regexp_replace(p_record->>'nid_no_norm','[^0-9]','','g'));
  end if;

  select string_agg(format('%I',keys.key),', ' order by keys.key) into v_columns
    from jsonb_object_keys(p_record) as keys(key)
    join information_schema.columns c on c.table_schema='ref' and c.table_name=p_table and c.column_name=keys.key
    where c.is_generated='NEVER' and c.identity_generation is null;
  select count(*)::integer into v_count from jsonb_object_keys(p_record);
  select count(*)::integer into v_valid from jsonb_object_keys(p_record) as keys(key)
    join information_schema.columns c on c.table_schema='ref' and c.table_name=p_table and c.column_name=keys.key;
  if v_count<>v_valid then raise exception 'unknown field for selected table' using errcode='22023'; end if;
  v_sql:=format('insert into ref.%I (%s) select %s from jsonb_populate_record(null::ref.%I,$1)',p_table,v_columns,v_columns,p_table);
  execute v_sql using p_record;
  insert into public.audit_logs(actor_id,actor_role,action,details)
    values(auth.uid(),'data_entry_operator','manual_reference_insert',jsonb_build_object('table',p_table,'identifier',v_value));
  return jsonb_build_object('inserted',true,'table',p_table,'identifier',v_value);
end $$;
revoke all on function public.data_entry_insert_record(text,jsonb) from public,anon;
grant execute on function public.data_entry_insert_record(text,jsonb) to authenticated;

commit;
