# Project Specification — Integrated Stage 1–3

## Purpose
A web-based land deed verification and application workflow prototype. It checks supplied reference records for identity, khatian/owner, previous deed, warish, government-interest and e-challan signals. It supports user applications and a restricted staff review path.

## Required user journey
Signup/login → user dashboard → verification → application wizard → ownership checks → fee/challan checks → submission/tracking → appointment → registrar review → correction/approval/rejection → DEMO registration record.

## Security invariants
- The existing `ref.*` reference schema is preserved. RLS remains enabled with no public policies; no reference table is granted direct browser access.
- User roles come from `public.profiles`, not form fields or user metadata.
- Public signup only creates ordinary users.
- Application write operations are server/RPC authorized and must re-check identity, role, ownership, state and jurisdiction.
- Registrar jurisdiction is `profiles.district + profiles.upazila`, matched against `deed_applications.office_district + office_upazila`.
- No real secret belongs in Git. The browser uses only Supabase URL and anon/publishable key.
- Finalization is an atomic PostgreSQL function with row lock, unique application/registration references, preconditions and audit record.
- Audit and registration register rows are append-only for normal database operations.

## Scope / exclusions
Included: Stage 1 verification foundation, Stage 2 application wizard and Stage 3 staff/admin workflow. Excluded or demo-only: official NID/government registry integration, actual payment confirmation, physical biometric capture, legally valid registration, official fee calculation, official ownership adjudication.

## Rules requiring external confirmation
1. Ownership entitlement across multiple dags and warish share calculations.
2. Meaning and weighting of Bangla name/father-name similarity and provisional 90% threshold.
3. Official fees, minimums, bases, taxes and challan grouping.
4. Official appointment slots, holidays and capacity.
5. Whether every office/jurisdiction can be accurately represented by district/upazila.
6. Official biometric procedure and what constitutes completed registration.
7. Official data/API access and legal authority for government integrations.
