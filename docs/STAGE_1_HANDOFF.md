# STAGE 1 HANDOFF  →  Stage 2 developer

Read first: `PROJECT_SPEC.md` (rules, conflicts, open decisions), `DATABASE_MAP.md`, `API_CONTRACTS.md`, `PROJECT_STATUS.md`.

## 1. Honest status of what was delivered
Stage 1 was produced in an environment with **no network and no database**. Everything below is real, written code, but only the pure logic is executed-tested. **First job: install, build, apply migration 06, smoke-test** (see §8).

| Feature | Status |
|---|---|
| Project foundation, Tailwind design system, reusable components, layouts, error/loading | Implemented (not compiled) |
| Supabase SSR integration (no service-role key), middleware, `.env.example` | Implemented (not run) |
| Login, signup, logout, session refresh, profile card | Implemented (not run live) |
| Server-side role routing + access denied | Implemented (not run live) |
| User dashboard | Functional tool links + clearly marked placeholders |
| Sub-registrar / admin dashboards | Shells only (placeholders marked) |
| NID/person verification | Implemented; needs migration 06 |
| Location cascade, khatian search, owners, dags, shares | Implemented; needs migration 06 |
| Owner-vs-NID comparison (provisional 90 %) | Implemented (server-side), unit-tested; needs migration 06 |
| Previous deeds on a dag (donor vs others) + indicative remaining land | Implemented, assumption-based; needs migration 06 |
| Warish certificate + heirs | Lookup only; not connected to entitlement (blocked: legal rules) |
| Deed lookup (number+date) incl. baya reference | Implemented; needs migration 06 |
| Name attestations | Shown in NID and owner-check results |
| Khas / government-interest check | Implemented; "no record ≠ clearance" enforced in UI text |
| E-challan check | Read-only comparison; does not mark used |
| Explainable indicators (source + reason + level) | Implemented, display only |
| Application tables, fees, biometric, final submit, registration, audit | **Not started** (Stage 2/3 — not attempted) |

## 2. Folder structure
See `ARCHITECTURE.md`. Key directories for you: `lib/verify/` (logic), `app/api/verify/` (routes), `supabase/migrations/` (SQL), `components/verify/` (UI).

## 3. Database objects reused / proposed
Reused read-only: all `ref.*` tables, `ref.bn2en`, `public.profiles`, `public.handle_new_user`. Proposed: `supabase/migrations/06_verification_rpcs.sql` (helper + 10 RPCs, grants). Details in `DATABASE_MAP.md`. **Never** run `00_reset_data.sql`, `02_seed_all.sql`, CSV imports or `01_schema.sql` again.

## 4. API / function contracts
`API_CONTRACTS.md`.

## 5. Environment variables
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (required), `NEXT_PUBLIC_SITE_URL` (optional). Real values were **not** supplied and are not in the repo. Set the same names in Vercel.

## 6. Files/directories to use in Stage 2
* New migrations → `supabase/migrations/07_…sql` (RLS on from creation; reviewed; additive).
* New write RPCs/routes → follow `lib/api.js` `verifyRoute` pattern or add server actions.
* New pages → `app/dashboard/…`, `app/sub-registrar/…`; guard with `requireRole`.
* Reuse `components/ui`, `components/verify/*` (e.g. `IdentityFields`, `LocationPicker`, `Indicators`).
* Do **not** edit `ref.*` data or add policies to `ref`.

## 7. Known bugs / unfinished
See `PROJECT_STATUS.md` "Known issues". Also: Header shows full-name/role only ≥ sm screens; Land workbench reuses donor NID/DOB typed in step 2 for step 3; dag history is per single dag; no pagination (data sets are small).

## 8. Stage 2 tasks (exact order)
1. `npm install`; `npm run build`; `npm run lint`; `npm test` — fix any build/lint errors; record results in `PROJECT_STATUS.md`.
2. In Supabase SQL Editor run `06_verification_rpcs.sql`, then `supabase/verify_rpc_security.sql` (expect 10 functions, anon cannot execute, `ref` has no policies).
3. Smoke-test with dummy data: sign in as `user1@example.com`; use each `/verify/*` page; confirm khatian with khas hit (8 exist, see `03_verify.sql` #7) shows HIGH; deeds chain (6, #8); the 3 father-name mismatches show "discrepancy review" + attestation. Test as `subreg.savar@example.com` (lands on `/sub-registrar`) and that `/admin` shows access-denied.
4. Test negatives: signed-out `POST /api/verify/nid` → 401; with the anon key via PostgREST `rpc/verify_nid` → permission denied; `select` on `ref` → not exposed.
5. **Get decisions from the owner** (see PROJECT_SPEC §6): sub-registrar scope, entitlement rules, fee rates, holidays, name-match rules.
6. Design & migrate application tables (`deed_applications` + step/progress, parties, plots, fees, `appointments`, biometric status, `registration_register`, `audit_logs`) with RLS: user = own rows; sub-registrar scope per decision; audit append-only.
7. Build the "Apply for Deed" wizard (11 steps, save/resume). Reuse Stage 1 lookups but **re-run verification server-side at save/submit**; never trust client-held results or numbers.
8. Link challans to applications (`used_in_application_no` → real reference, unique use enforced by DB), add per-challan Verify that records the link transactionally.
9. Add lookup rate-limiting/audit; decide email confirmation + SMTP.
Stage 3 (not for Stage 2): sub-registrar review checklist, send-back, atomic registration numbering, certified copies.
