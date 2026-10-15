# Database Migration Review and Runbook

## Scope and limits
The ZIP contains `06_verification_rpcs.sql`, `07_application_tables.sql`, `08_application_logic.sql`, `09_application_rpcs.sql`, and `10_stage3_registrar_admin.sql`. This is a source review, not proof of what is applied in any Supabase project. No live database migration history was available. Do not blindly rerun these files.

## Expected dependency order
| Order | File | Purpose and notable dependencies |
|---|---|---|
| 1 | `06_verification_rpcs.sql` | Verification RPCs against existing `ref.*` tables and helper functions such as `ref.bn2en`, `ref.set_updated_at`; assumes reference schema/data already exist. |
| 2 | `07_application_tables.sql` | Application schema/tables, fee and status configuration, triggers and RLS/grants; depends on `auth.users`, existing profiles/reference schema, and PostgreSQL UUID support. Contains configuration inserts—review their conflict behavior and current target rows before any rerun. |
| 3 | `08_application_logic.sql` | Application workflow logic and helper/RPC behavior; depends on tables and functions from 06–07. |
| 4 | `09_application_rpcs.sql` | User-facing application RPCs; depends on prior application schema/logic and grants. |
| 5 | `10_stage3_registrar_admin.sql` | Adds demo registration/audit tables and staff/admin RPCs; explicitly says it follows 06–09 and updates Stage 3 status rules. It does not reset reference data. |

This order is inferred from source references/comments and must be validated against the actual database schema and migration history before application.

## Safety findings
- Migration 10 creates `registration_register` with a unique `application_id` and unique `registration_ref`, enables RLS, and revokes browser table grants.
- Migration 10 creates `audit_logs`, enables RLS, revokes browser table grants, and adds mutation-blocking triggers.
- Migration 10 uses `SECURITY DEFINER` functions with an empty `search_path` and schema-qualified names. The functions perform role checks against `public.profiles`.
- Migration 10 updates rows in `public.application_status_rules` for Stage 3 transitions. It is not entirely schema-only/additive: it mutates workflow configuration.
- Migration 07 contains inserts into `public.fee_config`, `appointment_rules`, and `application_status_rules`. Do not rerun without checking the exact statements, conflicts, and existing rows.
- The migration files use `CREATE OR REPLACE FUNCTION`, `CREATE TABLE IF NOT EXISTS`, and trigger drop/recreate patterns in places, but that does not make every migration universally safe to rerun.
- Do not reset, truncate, drop, or reseed `ref.*` tables. No live migration was executed during this review.

## Safe operator procedure
1. Take and verify a database backup.
2. In Supabase SQL Editor or CLI, inspect the migration history table and compare each migration's objects with the target database. Record which files were actually applied.
3. Restore a staging project from an appropriate schema/data baseline (preserving reference data), then test the missing migrations there first.
4. Inspect every migration's complete SQL and confirm prerequisites. Do not apply based solely on filename order.
5. Apply only missing approved migrations in order. Do not run all files blindly.
6. Run `supabase/verify_rpc_security.sql`, `supabase/verify_stage2_security.sql`, and the manual checks in `supabase/tests/` after adapting them to the staging environment.
7. Test cross-user ownership, cross-jurisdiction registrar access, admin-only summary, unauthorized RPC calls, challan mismatch/reuse, duplicate finalization, and append-only audit behavior.
8. Record applied migration versions and evidence in the deployment ticket.

## Verification status
- Local source review: completed.
- Actual Supabase migration history: unavailable/unverified.
- SQL execution/syntax against a live PostgreSQL instance: not performed.
- Live RLS/authorization tests: not performed.
