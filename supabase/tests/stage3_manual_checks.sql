-- Stage 3 manual security/workflow checks. Run only in a non-production project after 06-10.
-- Set up test accounts and applications using the normal application workflow first.
-- These are diagnostic SELECTs; they do not create fake roles or mutate reference data.

-- 1) Check registrar profile mapping and duplicate jurisdiction constraints.
select email, role, district, upazila
from public.profiles
where role in ('admin','sub_registrar')
order by role, district, upazila;

-- 2) Ensure Stage 3 transition rules are active.
select from_status, to_status, actor_role, active
from public.application_status_rules
where stage=3
order by from_status,to_status;

-- 3) Ensure reference RLS remains enabled and no public policies were added.
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname='ref'
order by tablename;
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname='ref';

-- 4) Confirm Stage 3 tables are RLS-enabled and client grants are absent.
select c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('registration_register','audit_logs');
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema='public' and table_name in ('registration_register','audit_logs')
  and grantee in ('anon','authenticated');

-- 5) Check duplicate registrations cannot exist.
select application_id, count(*) from public.registration_register
group by application_id having count(*)>1;
select registration_ref, count(*) from public.registration_register
group by registration_ref having count(*)>1;

-- 6) Check audit/registration are append-only by attempting UPDATE/DELETE in a disposable
-- staging transaction. Expected: trigger raises "records are append-only".
-- Do not disable triggers to make this test pass.

-- 7) Required API tests (use actual authenticated sessions, not SQL Editor):
-- - ordinary user: staff_queue, staff_application_detail, staff_decide_application,
--   staff_finalize_registration, admin_summary all reject.
-- - registrar A: can only see rows with office_district/upazila matching profile.
-- - registrar A: cannot detail, decide, or finalize registrar B's application.
-- - admin: can access queue/detail/summary but cannot change role through browser.
-- - application with blockers, missing biometric status, unapproved state, invalid challan,
--   or duplicate finalization: finalization rejected and no partial record remains.
-- - two concurrent finalization calls for one eligible application: exactly one succeeds.
