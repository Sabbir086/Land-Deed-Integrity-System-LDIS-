-- Read-only checks to run in the SQL Editor AFTER migrations 07, 08, 09. Expected results in comments.

-- 1) RLS enabled on every Stage 2 table (expected: 0 rows = none missing)
select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
   and c.relname in ('fee_config','appointment_rules','public_holidays','application_status_rules','deed_applications','application_parties',
     'application_ownership','application_plots','application_fee_items','application_challans','application_status_history','application_corrections',
     'application_documents','application_appointments','application_appointment_events','user_notifications');

-- 2) Browsers can only SELECT: any insert/update/delete grant to anon/authenticated (expected: 0 rows)
select table_name, grantee, privilege_type from information_schema.role_table_grants
 where table_schema = 'public' and grantee in ('anon','authenticated') and privilege_type <> 'SELECT'
   and table_name in ('fee_config','appointment_rules','public_holidays','application_status_rules','deed_applications','application_parties',
     'application_ownership','application_plots','application_fee_items','application_challans','application_status_history','application_corrections',
     'application_documents','application_appointments','application_appointment_events','user_notifications');

-- 3) anon has no SELECT on application tables (expected: 0 rows)
select table_name from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon' and table_name like 'application\_%';

-- 4) 18 public RPCs, none executable by anon (expected: 18 rows with anon_can_execute = false)
select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon_can_execute, has_function_privilege('authenticated', p.oid, 'execute') as auth_can_execute
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and (p.proname like 'app\_%' or p.proname = 'notifications_mark_read') order by 1;

-- 5) Internal app.* functions are not executable by anon/authenticated (expected: 0 rows)
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'app' and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'));

-- 6) ref schema still has RLS and no policies (expected: 0 rows)
select schemaname, tablename, policyname from pg_policies where schemaname = 'ref';

-- 7) Fee config is clearly demo (expected: stamp/registration/source_tax active+demo; e_fee/n_fee/nn_fee inactive)
select fee_code, rate_percent, is_demo, active from public.fee_config order by sort_order;

-- 8) Storage bucket is private (expected: public = false)
select id, public, file_size_limit from storage.buckets where id = 'application-docs';
