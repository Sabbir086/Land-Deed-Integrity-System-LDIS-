-- LDIS migration 25: fix manual NID/attestation entry, generate serials, add porcha entry,
-- and allow land records to be searched by dag number. Additive to existing reference data.
-- Run after migrations 15 and 22-24. This migration does not reset or replace any database.

begin;

create or replace function public.data_entry_location_options(
  p_level text,
  p_division text default null,
  p_district text default null,
  p_upazila text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_approved boolean;
  v_result jsonb;
begin
  select p.role, p.is_approved into v_role, v_approved
  from public.profiles p where p.id = auth.uid();

  if v_role is distinct from 'data_entry_operator' or v_approved is distinct from true then
    raise exception 'approved data entry operator required' using errcode = '42501';
  end if;

  if p_level = 'division' then
    select coalesce(jsonb_agg(x.value order by x.value), '[]'::jsonb) into v_result
    from (select distinct l.division as value from ref.locations l) x;
  elsif p_level = 'district' then
    select coalesce(jsonb_agg(x.value order by x.value), '[]'::jsonb) into v_result
    from (select distinct l.district as value from ref.locations l where l.division = p_division) x;
  elsif p_level = 'upazila' then
    select coalesce(jsonb_agg(x.value order by x.value), '[]'::jsonb) into v_result
    from (select distinct l.upazila as value from ref.locations l
          where l.division = p_division and l.district = p_district) x;
  elsif p_level = 'mouza' then
    select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'name', x.mouza) order by x.mouza), '[]'::jsonb) into v_result
    from (select l.id, l.mouza from ref.locations l
          where l.division = p_division and l.district = p_district and l.upazila = p_upazila) x;
  else
    raise exception 'invalid location level' using errcode = '22023';
  end if;

  return v_result;
end;
$$;

revoke all on function public.data_entry_location_options(text, text, text, text) from public, anon;
grant execute on function public.data_entry_location_options(text, text, text, text) to authenticated;

create or replace function public.data_entry_insert_record(p_table text, p_record jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_approved boolean;
  v_key text;
  v_value text;
  v_columns text;
  v_sql text;
  v_duplicate boolean := false;
  v_count integer;
  v_valid integer;
  v_fiscal_code text;
  v_serial bigint;
  v_owner_rows jsonb := '[]'::jsonb;
  v_dag_rows jsonb := '[]'::jsonb;
  v_heir_rows jsonb := '[]'::jsonb;
  v_row jsonb;
  v_person_name text;
  v_person_count integer;
  v_person_id uuid;
  v_khatian_id uuid;
  v_warish_id uuid;
  v_khatian_norm text;
  v_owner_serial integer := 0;
  v_dag_serial integer := 0;
  v_numeric_value numeric;
begin
  select p.role, p.is_approved into v_role, v_approved
  from public.profiles p where p.id = auth.uid();
  if v_role is distinct from 'data_entry_operator' or v_approved is distinct from true then
    raise exception 'approved data entry operator required' using errcode = '42501';
  end if;

  if p_table not in ('echallans', 'nid_persons', 'warish_certs', 'name_attestations', 'khatians')
     or jsonb_typeof(p_record) <> 'object' or p_record = '{}'::jsonb then
    raise exception 'invalid table or record' using errcode = '22023';
  end if;

  -- E-challan numbers retain the existing, transaction-safe 2627-10001 sequence.
  if p_table = 'echallans' then
    update public.challan_number_counter
       set last_number = last_number + 1
     where id = true
     returning fiscal_code, last_number into v_fiscal_code, v_serial;
    if not found then
      raise exception 'challan number counter is not configured' using errcode = '55000';
    end if;
    v_value := v_fiscal_code || '-' || lpad(v_serial::text, 5, '0');
    p_record := (p_record - 'challan_no' - 'challan_no_norm') || jsonb_build_object(
      'challan_no', v_value,
      'challan_no_norm', v_value,
      'verify_status', coalesce(p_record->>'verify_status', 'verified')
    );
    v_key := 'challan_no_norm';

  elsif p_table = 'nid_persons' then
    v_value := regexp_replace(ref.bn2en(coalesce(p_record->>'nid_no', p_record->>'nid_no_norm')), '[^0-9]', '', 'g');
    if v_value !~ '^[0-9]{10,17}$' then
      raise exception 'NID নম্বর ১০ থেকে ১৭ digit হতে হবে' using errcode = '22023';
    end if;
    p_record := (p_record - 'nid_no_norm') || jsonb_build_object('nid_no', v_value, 'nid_no_norm', v_value);
    v_key := 'nid_no_norm';

  elsif p_table = 'warish_certs' then
    v_heir_rows := coalesce(p_record->'heirs', '[]'::jsonb);
    p_record := p_record - 'heirs';
    if jsonb_typeof(v_heir_rows) <> 'array' or jsonb_array_length(v_heir_rows) < 1 or jsonb_array_length(v_heir_rows) > 100 then
      raise exception 'ওয়ারিশ সনদে ১ থেকে ১০০ জন ওয়ারিশ দিতে হবে' using errcode = '22023';
    end if;
    -- Serialize number generation so two operators cannot receive the same next number.
    perform pg_advisory_xact_lock(hashtext('ldis:warish_certs:cert_no'));
    select greatest(coalesce(max((regexp_match(x.cert_no, '^WAR-([0-9]+)$', 'i'))[1]::bigint), 100), 100) + 1
      into v_serial
      from ref.warish_certs x
     where x.cert_no ~* '^WAR-[0-9]+$';
    v_value := 'WAR-' || lpad(v_serial::text, 3, '0');
    p_record := (p_record - 'cert_no') || jsonb_build_object('cert_no', v_value);
    v_key := 'cert_no';

  elsif p_table = 'name_attestations' then
    v_person_name := nullif(regexp_replace(btrim(coalesce(p_record->>'person_name', '')), '[[:space:]]+', ' ', 'g'), '');
    if v_person_name is null then
      raise exception 'প্রত্যয়নের জন্য ব্যক্তির নাম দিতে হবে' using errcode = '22023';
    end if;

    select count(*)::integer, min(x.id::text)::uuid
      into v_person_count, v_person_id
      from ref.nid_persons x
     where lower(regexp_replace(btrim(x.name_bn), '[[:space:]]+', ' ', 'g')) = lower(v_person_name);
    if v_person_count = 0 then
      raise exception 'PERSON_NAME_NOT_FOUND: এই নামে NID ব্যক্তির তথ্য আগে যোগ করুন' using errcode = 'P0002';
    elsif v_person_count > 1 then
      raise exception 'PERSON_NAME_AMBIGUOUS: একই নামে একাধিক ব্যক্তি আছে; NID ডাটাবেজে নামটি আলাদা করে শনাক্ত করুন' using errcode = '22023';
    end if;

    perform pg_advisory_xact_lock(hashtext('ldis:name_attestations:attestation_no'));
    select greatest(coalesce(max((regexp_match(x.attestation_no, '^ATT-([0-9]+)$', 'i'))[1]::bigint), 100), 100) + 1
      into v_serial
      from ref.name_attestations x
     where x.attestation_no ~* '^ATT-[0-9]+$';
    v_value := 'ATT-' || lpad(v_serial::text, 3, '0');
    p_record := (p_record - 'attestation_no' - 'person_name') || jsonb_build_object(
      'attestation_no', v_value,
      'person_id', v_person_id::text
    );
    v_key := 'attestation_no';

  else
    -- Parent porcha row plus nested owners/dags. Only existing location IDs are accepted.
    v_owner_rows := coalesce(p_record->'owners', '[]'::jsonb);
    v_dag_rows := coalesce(p_record->'dags', '[]'::jsonb);
    p_record := p_record - 'owners' - 'dags';
    if jsonb_typeof(v_owner_rows) <> 'array' or jsonb_array_length(v_owner_rows) < 1 or jsonb_array_length(v_owner_rows) > 50 then
      raise exception 'পর্চায় ১ থেকে ৫০ জন মালিক দিতে হবে' using errcode = '22023';
    end if;
    if jsonb_typeof(v_dag_rows) <> 'array' or jsonb_array_length(v_dag_rows) < 1 or jsonb_array_length(v_dag_rows) > 50 then
      raise exception 'পর্চায় ১ থেকে ৫০টি দাগ দিতে হবে' using errcode = '22023';
    end if;
    if nullif(p_record->>'location_id', '') is null or nullif(btrim(p_record->>'khatian_type'), '') is null
       or nullif(btrim(p_record->>'khatian_no'), '') is null then
      raise exception 'মৌজা, খতিয়ানের ধরন ও নম্বর দিতে হবে' using errcode = '22023';
    end if;

    v_khatian_norm := regexp_replace(ref.bn2en(p_record->>'khatian_no'), '[^0-9]', '', 'g');
    if v_khatian_norm !~ '^[0-9]{1,12}$' then
      raise exception 'খতিয়ান নম্বর ১ থেকে ১২ digit হতে হবে' using errcode = '22023';
    end if;
    p_record := p_record || jsonb_build_object('khatian_no_norm', v_khatian_norm);
    v_value := btrim(p_record->>'khatian_no');
    v_key := 'khatian_no_norm';

    if exists (
      select 1 from ref.khatians k
       where k.location_id = (p_record->>'location_id')::uuid
         and k.khatian_type = p_record->>'khatian_type'
         and k.khatian_no_norm = v_khatian_norm
    ) then
      raise exception 'DUPLICATE_RECORD' using errcode = '23505';
    end if;
  end if;

  if p_table <> 'khatians' then
    if v_value is null or btrim(v_value) = '' then
      raise exception 'required identifier missing' using errcode = '22023';
    end if;
    execute format('select exists(select 1 from ref.%I where %I::text = $1)', p_table, v_key)
       into v_duplicate using v_value;
    if v_duplicate then raise exception 'DUPLICATE_RECORD' using errcode = '23505'; end if;
  end if;

  -- Ensure every submitted database column really belongs to the selected table.
  select count(*)::integer into v_count from jsonb_object_keys(p_record);
  select count(*)::integer into v_valid
    from jsonb_object_keys(p_record) as keys(key)
    join information_schema.columns c
      on c.table_schema = 'ref' and c.table_name = p_table and c.column_name = keys.key;
  if v_count <> v_valid then raise exception 'unknown field for selected table' using errcode = '22023'; end if;

  select string_agg(format('%I', keys.key), ', ' order by keys.key) into v_columns
    from jsonb_object_keys(p_record) as keys(key)
    join information_schema.columns c
      on c.table_schema = 'ref' and c.table_name = p_table and c.column_name = keys.key
   where c.is_generated = 'NEVER' and c.identity_generation is null;

  if p_table = 'warish_certs' then
    v_sql := format(
      'insert into ref.%I (%s) select %s from jsonb_populate_record(null::ref.%I, $1) returning id',
      p_table, v_columns, v_columns, p_table
    );
    execute v_sql into v_warish_id using p_record;

    for v_row in select value from jsonb_array_elements(v_heir_rows)
    loop
      v_owner_serial := v_owner_serial + 1;
      v_person_name := nullif(regexp_replace(btrim(coalesce(v_row->>'person_name', '')), '[[:space:]]+', ' ', 'g'), '');
      if v_person_name is null or nullif(btrim(coalesce(v_row->>'relation', '')), '') is null then
        raise exception 'প্রত্যেক ওয়ারিশের নাম ও সম্পর্ক দিতে হবে' using errcode = '22023';
      end if;
      select count(*)::integer, min(x.id::text)::uuid
        into v_person_count, v_person_id
        from ref.nid_persons x
       where lower(regexp_replace(btrim(x.name_bn), '[[:space:]]+', ' ', 'g')) = lower(v_person_name);
      if v_person_count = 0 then
        raise exception 'HEIR_NAME_NOT_FOUND: এই নামে NID ব্যক্তির তথ্য আগে যোগ করুন' using errcode = 'P0002';
      elsif v_person_count > 1 then
        raise exception 'HEIR_NAME_AMBIGUOUS: একই নামে একাধিক ব্যক্তি আছে; NID ডাটাবেজে নামটি আলাদা করে শনাক্ত করুন' using errcode = '22023';
      end if;
      v_numeric_value := (v_row->>'share')::numeric;
      if v_numeric_value <= 0 or v_numeric_value > 1 then
        raise exception 'ওয়ারিশের অংশ ০-এর বেশি এবং ১ বা তার কম হতে হবে' using errcode = '22023';
      end if;
      insert into ref.warish_heirs(cert_id, serial, heir_id, relation, share)
      values (v_warish_id, v_owner_serial, v_person_id, btrim(v_row->>'relation'), v_numeric_value);
    end loop;

  elsif p_table = 'khatians' then
    v_sql := format(
      'insert into ref.%I (%s) select %s from jsonb_populate_record(null::ref.%I, $1) returning id',
      p_table, v_columns, v_columns, p_table
    );
    execute v_sql into v_khatian_id using p_record;

    for v_row in select value from jsonb_array_elements(v_owner_rows)
    loop
      v_owner_serial := v_owner_serial + 1;
      if nullif(btrim(coalesce(v_row->>'owner_name', '')), '') is null then
        raise exception 'প্রত্যেক মালিকের নাম দিতে হবে' using errcode = '22023';
      end if;
      v_numeric_value := (v_row->>'share')::numeric;
      if v_numeric_value <= 0 or v_numeric_value > 1 then
        raise exception 'মালিকের অংশ ০-এর বেশি এবং ১ বা তার কম হতে হবে' using errcode = '22023';
      end if;
      insert into ref.khatian_owners(khatian_id, serial, owner_name, father_name, share)
      values (v_khatian_id, v_owner_serial, btrim(v_row->>'owner_name'), nullif(btrim(v_row->>'father_name'), ''), v_numeric_value);
    end loop;

    for v_row in select value from jsonb_array_elements(v_dag_rows)
    loop
      v_dag_serial := v_dag_serial + 1;
      if nullif(btrim(coalesce(v_row->>'dag_no', '')), '') is null
         or nullif(btrim(coalesce(v_row->>'land_class', '')), '') is null then
        raise exception 'প্রত্যেক দাগের নম্বর ও জমির শ্রেণি দিতে হবে' using errcode = '22023';
      end if;
      v_numeric_value := (v_row->>'area')::numeric;
      if v_numeric_value <= 0 then raise exception 'দাগের পরিমাণ শূন্যের বেশি হতে হবে' using errcode = '22023'; end if;
      insert into ref.khatian_dags(khatian_id, serial, dag_no, land_class, area)
      values (v_khatian_id, v_dag_serial, btrim(v_row->>'dag_no'), btrim(v_row->>'land_class'), v_numeric_value);
    end loop;
  else
    v_sql := format(
      'insert into ref.%I (%s) select %s from jsonb_populate_record(null::ref.%I, $1)',
      p_table, v_columns, v_columns, p_table
    );
    execute v_sql using p_record;
  end if;

  insert into public.audit_logs(actor_id, actor_role, action, details)
  values (auth.uid(), 'data_entry_operator', 'manual_reference_insert', jsonb_build_object(
    'table', p_table,
    'identifier', v_value,
    'owners_added', case when p_table = 'khatians' then v_owner_serial else null end,
    'heirs_added', case when p_table = 'warish_certs' then v_owner_serial else null end,
    'dags_added', case when p_table = 'khatians' then v_dag_serial else null end
  ));

  return jsonb_build_object(
    'inserted', true,
    'table', p_table,
    'identifier', v_value,
    'owners_added', case when p_table = 'khatians' then v_owner_serial else null end,
    'heirs_added', case when p_table = 'warish_certs' then v_owner_serial else null end,
    'dags_added', case when p_table = 'khatians' then v_dag_serial else null end
  );
end;
$$;

revoke all on function public.data_entry_insert_record(text, jsonb) from public, anon;
grant execute on function public.data_entry_insert_record(text, jsonb) to authenticated;

-- Read-only, approved-admin/sub-registrar RPC to find porcha records by dag number.
create or replace function public.verify_khatian_by_dag(
  p_location_id uuid,
  p_khatian_type text,
  p_dag_no text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_dag_norm text;
  v_candidates jsonb;
  v_count integer;
begin
  v_role := ref.assert_app_user();
  v_dag_norm := regexp_replace(ref.bn2en(p_dag_no), '[^0-9]', '', 'g');
  if p_location_id is null or nullif(btrim(p_khatian_type), '') is null or v_dag_norm !~ '^[0-9]{1,12}$' then
    raise exception 'invalid input' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'found', true,
    'khatian', jsonb_build_object(
      'id', k.id,
      'khatian_type', k.khatian_type,
      'khatian_no', k.khatian_no,
      'location_id', l.id,
      'division', l.division,
      'district', l.district,
      'upazila', l.upazila,
      'mouza', l.mouza
    ),
    'owners', coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'serial', o.serial, 'owner_name', o.owner_name,
        'father_name', o.father_name, 'share', o.share) order by o.serial)
      from ref.khatian_owners o where o.khatian_id = k.id
    ), '[]'::jsonb),
    'dags', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'serial', d.serial, 'dag_no', d.dag_no,
        'land_class', d.land_class, 'area', d.area) order by d.serial)
      from ref.khatian_dags d where d.khatian_id = k.id
    ), '[]'::jsonb),
    'share_total', (select coalesce(sum(o.share), 0) from ref.khatian_owners o where o.khatian_id = k.id),
    'share_status', case when abs((select coalesce(sum(o.share), 0) from ref.khatian_owners o where o.khatian_id = k.id) - 1) < 0.0005 then 'OK' else 'CHECK' end
  ) order by k.khatian_no), '[]'::jsonb), count(*)
    into v_candidates, v_count
    from ref.khatians k
    join ref.locations l on l.id = k.location_id
   where k.location_id = p_location_id
     and k.khatian_type = p_khatian_type
     and exists (
       select 1 from ref.khatian_dags d where d.khatian_id = k.id
        and regexp_replace(ref.bn2en(d.dag_no), '[^0-9]', '', 'g') = v_dag_norm
     );

  if coalesce(v_count, 0) = 0 then
    return jsonb_build_object('found', false);
  elsif v_count = 1 then
    return v_candidates->0;
  end if;
  return jsonb_build_object('found', false, 'multiple', true, 'candidates', v_candidates);
end;
$$;

revoke all on function public.verify_khatian_by_dag(uuid, text, text) from public, anon;
grant execute on function public.verify_khatian_by_dag(uuid, text, text) to authenticated;

commit;
