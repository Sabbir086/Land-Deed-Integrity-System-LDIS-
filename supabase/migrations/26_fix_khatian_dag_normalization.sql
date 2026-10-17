-- LDIS migration 26: normalize dag_no_norm for manual porcha inserts.
-- Additive only: does not recreate tables or delete any reference records.
-- Fixes: null value in column "dag_no_norm" of relation "khatian_dags".

begin;

create or replace function ref.sync_khatian_dag_norm()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.dag_no_norm := ref.bn2en(new.dag_no);
  return new;
end;
$$;

do $$
declare
  v_generated text;
begin
  select c.is_generated
    into v_generated
    from information_schema.columns c
   where c.table_schema = 'ref'
     and c.table_name = 'khatian_dags'
     and c.column_name = 'dag_no_norm';

  if v_generated is null then
    raise exception 'Missing required column ref.khatian_dags.dag_no_norm; no data was changed.';
  elsif v_generated = 'NEVER' then
    -- Backfill any stale normal forms before enabling the insert/update hook.
    update ref.khatian_dags d
       set dag_no_norm = ref.bn2en(d.dag_no)
     where d.dag_no_norm is distinct from ref.bn2en(d.dag_no);

    execute 'drop trigger if exists trg_khatian_dags_sync_dag_norm on ref.khatian_dags';
    execute 'create trigger trg_khatian_dags_sync_dag_norm before insert or update on ref.khatian_dags for each row execute function ref.sync_khatian_dag_norm()';
  end if;
  -- If dag_no_norm is a GENERATED column, PostgreSQL computes it automatically;
  -- no trigger is needed in that schema.
end;
$$;

commit;
