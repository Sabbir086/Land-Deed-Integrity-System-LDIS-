-- LDIS migration 14: Super Admin-only import of test records into ref tables.
-- Additive only: does not delete, truncate, or reset existing data.

begin;

create or replace function public.super_admin_import_dummy_data(
  p_table text,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_role text;
  v_approved boolean;
  v_row jsonb;
  v_columns text;
  v_sql text;
  v_count integer := 0;
  v_key_count integer;
  v_valid_count integer;
begin
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_email <> 'joysabbir086@gmail.com' then
    raise exception 'Super Admin only' using errcode = '42501';
  end if;

  select p.role, p.is_approved into v_role, v_approved
  from public.profiles p where p.id = auth.uid();
  if v_role is distinct from 'admin' or v_approved is distinct from true then
    raise exception 'Approved admin required' using errcode = '42501';
  end if;

  if p_table not in (
    'nid_persons', 'locations', 'khatians', 'khatian_owners', 'khatian_dags', 'khas_govt',
    'warish_certs', 'warish_heirs', 'name_attestations', 'echallans', 'deeds'
  ) then
    raise exception 'Table is not allowed' using errcode = '22023';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) < 1 or jsonb_array_length(p_rows) > 500 then
    raise exception 'Provide between 1 and 500 records' using errcode = '22023';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_count := v_count + 1;
    if jsonb_typeof(v_row) <> 'object' or v_row = '{}'::jsonb then
      raise exception 'Every record must be a non-empty JSON object' using errcode = '22023';
    end if;

    select count(*)::integer into v_key_count from jsonb_object_keys(v_row);
    select count(*)::integer into v_valid_count
      from jsonb_object_keys(v_row) as k(key)
      join information_schema.columns c
        on c.table_schema = 'ref' and c.table_name = p_table and c.column_name = k.key;
    if v_key_count <> v_valid_count then
      raise exception 'Unknown field in record % for table %', v_count, p_table using errcode = '22023';
    end if;

    select string_agg(format('%I', k.key), ', ' order by k.key)
      into v_columns from jsonb_object_keys(v_row) as k(key);
    v_sql := format(
      'insert into ref.%I (%s) select %s from jsonb_populate_record(null::ref.%I, $1)',
      p_table, v_columns, v_columns, p_table
    );
    execute v_sql using v_row;
  end loop;

  return jsonb_build_object('inserted', v_count);
end;
$$;

revoke all on function public.super_admin_import_dummy_data(text, jsonb) from public, anon;
grant execute on function public.super_admin_import_dummy_data(text, jsonb) to authenticated;

commit;
