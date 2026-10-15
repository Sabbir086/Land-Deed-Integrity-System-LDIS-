-- Manual scenario checks for Stage 2. NOT executed by the Stage 2 developer (no database in the build sandbox).
-- Run each block in the SQL Editor. Every block is wrapped in a transaction and ROLLED BACK, so it leaves no data.
-- It impersonates user1@example.com the way PostgREST does. Replace <...> placeholders with ids from your dummy data
-- (pick them with the SELECT helpers at the top of each block).

-- ---- helper: find sample data -------------------------------------------------------------------------
-- select k.id, l.mouza, k.khatian_type, k.khatian_no from ref.khatians k join ref.locations l on l.id = k.location_id limit 10;
-- select nid_no_norm, dob, name_bn from ref.nid_persons limit 10;
-- select challan_no_norm, amount, fee_type, verify_status, used_in_application_no from ref.echallans limit 10;

-- ---- A) draft + ownership isolation ---------------------------------------------------------------------
begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'user1@example.com'), 'role', 'authenticated')::text, true);
set local role authenticated;
select public.app_create_draft();                         -- expect ok:true + application_no DA-2026-......
select count(*) from public.deed_applications;            -- expect 1 (own only)
reset role;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'user2@example.com'), 'role', 'authenticated')::text, true);
set local role authenticated;
select count(*) from public.deed_applications;            -- expect 0: user2 cannot see user1's draft (RLS)
-- select public.app_get('<user1 application id>');       -- expect ERROR 42501 (not yours)
rollback;

-- ---- B) staff cannot use applicant RPCs ---------------------------------------------------------------------
begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'subreg.savar@example.com'), 'role', 'authenticated')::text, true);
set local role authenticated;
select public.app_create_draft();                         -- expect ERROR 42501 (only applicant accounts)
rollback;

-- ---- C) browsers cannot write tables or change status directly -----------------------------------------------------
begin;
select set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = 'user1@example.com'), 'role', 'authenticated')::text, true);
set local role authenticated;
-- update public.deed_applications set status = 'registered';   -- expect ERROR permission denied
-- insert into public.application_challans (application_id, challan_type, challan_no, challan_no_norm, amount) values (gen_random_uuid(),'stamp','X','X',1); -- expect ERROR
rollback;

-- ---- D) full happy path (fill the placeholders, run statements one by one inside the same transaction) --------------
-- begin; <impersonate user1; set local role authenticated>;
-- select public.app_create_draft();                                                    -- note id => :app
-- select public.app_set_party(:app, 'donor', '<nid>', '<dob>');                          -- expect found:true
-- select public.app_set_party(:app, 'donee', '<other nid>', '<dob>');
-- select public.app_set_land(:app, '<location_id>', '<type>', '<khatian no>');
-- select public.app_set_ownership(:app, 'record_owner', '<owner id>', null, null, null);  -- look at ownership.status / flags
-- select public.app_set_plots(:app, '[{"dag_id":"<dag id>","area_sold":"0.5"}]');
-- select public.app_set_plots(:app, '[{"dag_id":"<dag id>","area_sold":"9999"}]');        -- expect blockers EXCEEDS_REMAINING / AREA_EXCEEDS_DAG
-- select public.app_set_details(:app, '[{"dag_id":"<dag id>","land_class":"নাল"}]', 100000);  -- fee items 1500/1000/1000
-- select public.app_verify_challan(:app, 'stamp', '<challan no>', 1500);                 -- ok:true only if the dummy record matches and is unused
-- select public.app_verify_challan(:app, 'stamp', '<same challan no>', 1500);            -- second APPLICATION must get reasons ["ALREADY_USED"]
-- select public.app_submit(:app, true);                                                  -- ok:false + blockers until appointment is booked
-- (book: select public.app_appointment_availability(:app); select public.app_book_appointment(:app, '<date>', '10:00');)
-- select public.app_submit(:app, true);                                                  -- ok:true; status submitted or discrepancy_review
-- select public.app_submit(:app, true);                                                  -- expect ERROR AP001 (no longer editable)
-- rollback;

-- ---- E) simulate a Stage 3 correction request (as postgres, bypasses RLS; for UI testing ONLY) ------------------------
-- update public.application_status_rules set active = true where from_status = 'submitted' and to_status = 'correction_requested';  -- (do not commit this in production)
-- update public.deed_applications set status = 'correction_requested' where id = '<app>';
-- insert into public.application_status_history (application_id, from_status, to_status, actor_role, note) values ('<app>','submitted','correction_requested','sub_registrar','manual test');
-- insert into public.application_corrections (application_id, message, steps) values ('<app>', 'Please re-check the donor father name.', '{1,3}');
-- Then open /dashboard/applications/<app>: the correction banner shows; /edit works; resubmitting resolves the correction.
