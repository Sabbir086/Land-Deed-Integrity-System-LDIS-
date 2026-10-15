-- Read-only smoke tests for 06_verification_rpcs.sql. Run in SQL Editor AFTER the migration.
-- 1) Expect 10 rows, all prosecdef = true and proconfig containing search_path=""
select p.proname, p.prosecdef, p.proconfig
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'verify\_%' order by 1;

-- 2) Expect: anon has NO execute, authenticated has execute (all 10 rows: anon=false, auth=true)
select p.proname,
       has_function_privilege('anon', p.oid, 'execute')          as anon_can_run,
       has_function_privilege('authenticated', p.oid, 'execute') as auth_can_run
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'verify\_%' order by 1;

-- 3) Expect: ref tables still have RLS on and no policies (0 rows from the second query)
select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='ref' and c.relkind='r' order by 1;
select * from pg_policies where schemaname = 'ref';
