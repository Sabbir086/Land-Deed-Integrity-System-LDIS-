# Database Map

## Existing reference schema — preserve
`ref.locations`, `ref.nid_persons`, `ref.khatians`, `ref.khatian_owners`, `ref.khatian_dags`, `ref.deeds`, `ref.warish_certs`, `ref.warish_heirs`, `ref.name_attestations`, `ref.khas_govt`, `ref.echallans`, `ref.bn2en()` and existing triggers/views. These are imported reference data and must not be reset, truncated, dropped or reseeded. RLS remains enabled; do not expose the `ref` schema or grant direct client access.

## Public application schema from Stage 2
- `profiles`: role and registrar jurisdiction; signup trigger assigns user role.
- `deed_applications`: application, state, jurisdiction routing, fee summary, flags/blockers, biometric status.
- `application_parties`, `application_ownership`, `application_plots`: identity/ownership and plot calculations.
- `application_fee_items`, `application_challans`: calculated fee items and linked challan evidence.
- `application_status_history`, `application_corrections`: status audit and correction requests.
- `application_documents`: private Storage metadata.
- `application_appointments`, `application_appointment_events`: appointment state and event history.
- `user_notifications`, `fee_config`, `appointment_rules`, `public_holidays`, `application_status_rules`, `lookup_attempts`: supporting configuration and operations.

## Stage 3 additions in migration 10
- `registration_register`: one row per application, unique `registration_ref`, unique `application_id`, DEMO mode and a snapshot. No direct browser grants; RLS enabled.
- `audit_logs`: actor, role, action, application, details and timestamp. No direct browser grants; RLS enabled. Update/delete trigger makes entries append-only.
- `app.registration_ref_seq`: server-only sequence.
- `public.staff_queue(text)`: staff queue, jurisdiction filtered inside SQL.
- `public.staff_application_detail(uuid)`: role/jurisdiction filtered detail aggregation.
- `public.staff_decide_application(uuid,text,text,smallint[])`: review, correction, rejection, appointment and biometric-status actions.
- `public.staff_finalize_registration(uuid)`: atomic DEMO finalization.
- `public.admin_summary()`: admin-only aggregate statistics, registrar list and recent audit.
- Existing documented Stage 3 transitions are activated in `application_status_rules`.

## Migration state
Stage 1/2 handoffs report migrations 06–09 as written but NOT applied as of 2026-10-15. This cannot be independently verified without database access. Migration 10 is newly delivered and pending. Compare against actual database objects and migration history before applying any SQL. Apply only missing migrations, in order 06 → 07 → 08 → 09 → 10. Never run reset/seed scripts.
