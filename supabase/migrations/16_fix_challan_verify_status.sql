-- LDIS migration 16: align legacy e-challan status `valid` with the
-- canonical `verified` value required by migrations 06, 08, 09, and 10.
-- Only positive legacy statuses are normalized. `pending` and `invalid`
-- records are deliberately left unchanged. No rows are inserted or deleted.

begin;

update ref.echallans
   set verify_status = 'verified'
 where lower(btrim(verify_status::text)) = 'valid';

commit;

-- Review the final status distribution after applying this migration.
select verify_status, count(*) as record_count
  from ref.echallans
 group by verify_status
 order by verify_status;
