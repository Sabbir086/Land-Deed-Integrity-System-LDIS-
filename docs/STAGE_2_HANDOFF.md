# STAGE 2 HANDOFF  →  Stage 3 developer

Read first: `PROJECT_STATUS.md`, `DATABASE_MAP.md` (Stage 2 section), `API_CONTRACTS.md`, `PROJECT_SPEC.md`.

## 0. Honest status — read this before trusting anything
Stage 2 was built in a sandbox with **no network and no database**, exactly like Stage 1. Therefore:
* `npm install`, `next build`, `next lint` were **not run**. All 88 JS files pass a syntax parse; 12/12 unit tests pass (Stage 1: 7, Stage 2: 5).
* **No SQL was executed.** Migrations 06 (Stage 1), 07, 08, 09 are all **written but NOT applied**. The plpgsql was reviewed by reading and a structural paren/`$$` check only. Expect to fix small SQL errors on the first run. Nothing in the UI has been exercised against a real Supabase project.
* Stage 1's prerequisite "install, build, apply 06, smoke-test" is **still undone**. Stage 2 *depends on* 06 (it calls `public.verify_nid`, `public.verify_khatian`). I did not edit 06.
First job for whoever has a database: follow §9.

## 1. Implemented (written; unverified live)
| Area | What exists |
|---|---|
| Wizard | 9 steps: parties → land/khatian → ownership basis → dags & area → class & price → fees & challans → documents → appointment → review & submit. Save on every step, resume at saved step, navigation gated by server-computed blockers. |
| Ownership routes | Recorded owner (name+father vs NID, provisional 90 %), warish certificate (donor must be an heir; deceased vs porcha owner check), baya deed (previous deed's donee must equal donor; same khatian). Each can end *provisional / review / blocked*. **No route ever "establishes" ownership**; the UI says so. |
| Entitlement | Per dag, recomputed server-side: record owner = area × share; warish = area × owner share × heir share; baya = area acquired by the previous deed. Minus donor's earlier sales. Selling more than remaining ⇒ **blocked**; already-oversold, dag-oversold, government interest, identity/baya/warish mismatch ⇒ **HIGH flags** ⇒ application is held in `discrepancy_review` on submit. All assumptions are shown to the user and are **unconfirmed** (PROJECT_SPEC §6). |
| Fees | `public.fee_config` (configurable). **Demo** rates 1.5 % / 1 % / 1 % (the sample figures in the project document; labelled DEMO everywhere). e-fee/n-fee/nn-fee exist as *inactive* rows (no rate supplied). Per-fee rate, basis, base, amount, challan group shown. |
| Challans | One per fee type; amount due comes from the server; checks: found, amount = due, amount = record, fee type, record verified, not already used (ref placeholder link or another application). `unique(challan_no_norm)` makes reuse impossible even under a race. Stale challans are auto-released if price/record changes. |
| Tracking | `/dashboard/applications` (list), `/[id]` (detail, explanation, timeline, flags, corrections, fees, appointment, withdraw), `/[id]/edit` (wizard; also used for resubmission). |
| Appointments | Availability from `appointment_rules` (+ `public_holidays`, empty), advisory-locked booking, reschedule, cancel, event history. Office = sub-registrar profile for the land's upazila. **Booking never sets biometric status.** |
| Notifications | `user_notifications` rows on submit, appointment booked/cancelled, withdraw; list + mark-read on dashboard. |
| Documents | Private Storage bucket `application-docs` + metadata table; optional; owner-only. |
| Throttle | NID, challan, ownership lookups inside Stage 2 RPCs are rate-limited (30/20/60 per 10 min). Stage 1's stand-alone `/api/verify/*` lookups are **not** throttled. |

## 2. Not implemented / incomplete
* Sub-registrar/admin side (review, checklist, send-back, confirm/complete appointment, registration) — Stage 3. `/sub-registrar` is still the Stage 1 shell.
* No staff read policy on any application table (decision pending: own upazila vs all).
* Official fee rates, holidays, office slots/capacity, entitlement rules, warish legal rule, name-match rules: **demo/assumption**.
* Email/SMS notifications; document virus scanning; challan verification against a real government service.
* Partition, joint-ownership change, cancelled deeds, purchases (outside the baya route) are not part of entitlement.
* "Other documented ownership route": none is documented beyond the three above, so none was invented.
* Component/E2E tests (no browser or DB here).

## 3. Files
**Added** — `supabase/migrations/07_application_tables.sql`, `08_application_logic.sql`, `09_application_rpcs.sql`; `supabase/verify_stage2_security.sql`; `supabase/tests/stage2_manual_checks.sql`; `lib/app-api.js`; `lib/applications/{status,steps,schemas,format}.js`; `app/api/applications/[action]/route.js`; `app/dashboard/applications/page.js`, `[id]/page.js`, `[id]/edit/page.js`; `components/applications/{api,StatusBadge,FeeTable,Wizard,StepParties,StepLand,StepOwnership,StepPlots,StepDetails,StepFees,StepDocuments,StepAppointment,StepReview,AppointmentPanel,DetailActions,NewApplicationButton}.js`; `tests/applications-lib.test.mjs`; `docs/STAGE_2_HANDOFF.md`.
**Modified** — `app/dashboard/page.js` (placeholders → working tiles, counts, notifications), `components/Header.js` ("আমার আবেদন" link for users), `README.md`, `package.json` (version/description only), `docs/PROJECT_STATUS.md`, `DATABASE_MAP.md`, `API_CONTRACTS.md`, `ARCHITECTURE.md`, `PROJECT_SPEC.md`.
**Untouched** — all Stage 1 verification code, auth, migration 06, `ref.*`. No new npm dependency.

## 4. Migrations (none applied)
| File | Content | Applied? |
|---|---|---|
| 06_verification_rpcs.sql (Stage 1) | 10 verify RPCs | **No** — required first |
| 07_application_tables.sql | schema `app`, 16 public tables + 1 internal, seeds (fee_config demo, appointment_rules, status rules), RLS, grants, storage bucket+policies | **No** |
| 08_application_logic.sql | internal functions: `app.recompute` (single source of derived truth), `app.view`, `app.change_status`, `app.name_similarity`, helpers | **No** |
| 09_application_rpcs.sql | 18 public RPCs, EXECUTE → authenticated only | **No** |
Order: 06 → 07 → 08 → 09, then `supabase/verify_rpc_security.sql` and `supabase/verify_stage2_security.sql`. All are additive and re-runnable. None changes `ref.*` data.

## 5. Status transitions (table `application_status_rules`; enforced by `app.change_status`)
| From → To | Actor | Active in Stage 2 |
|---|---|---|
| draft → submitted / discrepancy_review | user (final submit; HIGH flag ⇒ discrepancy_review) | yes |
| correction_requested → submitted / discrepancy_review | user (resubmission) | yes |
| draft, correction_requested, submitted, discrepancy_review → withdrawn | user | yes |
| submitted, discrepancy_review → under_review | sub_registrar | **no (Stage 3)** |
| submitted, under_review, discrepancy_review → correction_requested | sub_registrar | **no (Stage 3)** |
| under_review → registered / rejected | sub_registrar | **no (Stage 3)** |
Editable by the applicant only in `draft` and `correction_requested`. Stage 3 activates its rows (`active = true`) and adds RPCs that call `app.change_status(app, to, actor, 'sub_registrar', note)`.

## 6. Key decisions (deviations/interpretations)
1. **Application number is created with the draft** (`DA-YYYY-NNNNNN`), not at final submit. Reason: §12 stores the number in the appointment before §13 submit and §16 wants one number per application; `submitted_at` is the submit timestamp. Gaps from abandoned drafts are harmless.
2. **Business logic lives in the database** (security-definer RPCs), not in Next.js, because the app has no service-role key and a user could otherwise call an RPC with forged "results". Next.js routes only validate shape and forward with the visitor's session.
3. NID numbers are **not stored** (masked only). Parties keep `person_id` and a snapshot; `recompute` re-reads `ref.nid_persons` on every save/submit.
4. `ref.echallans.used_in_application_no` is **not written** (ref is read-only for the app). Reuse is tracked in `public.application_challans`; ref placeholder links (APP-0001…) are treated as "already used".
5. Appointment is required before final submit (workflow §12 → §13), checked server-side.
6. Only `role = 'user'` may create/edit applications; staff accounts get 42501.
7. After submission, flags are **frozen** (not recomputed) so reviewer evidence does not shift; Stage 3 may call `app.recompute` deliberately.
8. Matching/threshold reuse Stage 1 rules (Levenshtein, 90 %), ported to SQL `app.name_similarity`; the JS version in `lib/verify/matching.js` is still used by Stage 1 pages. **Keep them in sync** (no automated equivalence test yet — add one once a DB exists).

## 7. Known issues / risks
1. SQL never executed (see §0). Likely first-run suspects: `normalize(..., NFC)` availability, regex `\u200c` handling, `jsonb ? text` operator in `app_verify_challan`, storage policy creation if `storage` schema differs.
2. If most dummy challans have non-null `used_in_application_no`, none can be verified; pick unused ones: `select * from ref.echallans where used_in_application_no is null and verify_status='verified'`.
3. Booking needs a `sub_registrar` profile for the land's upazila; only 3 upazilas have one in the test data (others get a clear message).
4. `public_holidays` is empty ⇒ holidays are not excluded (UI says so). Fri/Sat excluded by default (demo rule).
5. Lookup throttling covers Stage 2 RPCs only.
6. No pagination on the application list.
7. Dashboard notification count is not shown in the header.
8. Challan "match" proves nothing about real payment (UI says so).
9. `app.recompute` deletes/reinserts fee items on every save (fine at this scale).

## 8. Exact Stage 3 tasks
1. Complete §9 verification first (apply 06–09, run both security scripts, smoke-test).
2. Decide staff visibility (own upazila vs all) → add SELECT policies on `deed_applications` and children (via `public.my_role()`/profiles) and a storage read policy for documents.
3. Sub-registrar dashboard: queues (submitted, discrepancy_review, under_review, appointment today), list by application no/serial; detail page showing parties, khatian, ownership checks (`application_ownership.checks`), plots (`history`, `khas_matches`), `flags`, fee items, challans, documents (signed URLs).
4. Review checklist table + per-section checkboxes; "send back" RPC → insert `application_corrections` (message + `steps` smallint[]), `app.change_status(... 'correction_requested')`, notification (kind `status_changed`). The user UI already renders corrections and resubmits.
5. RPCs: start review (`submitted|discrepancy_review → under_review`), confirm/complete/mark-missed appointment (set `application_appointments.status`; only here may `deed_applications.biometric_status = 'completed'`).
6. Atomic registration: `registration_register` table + sequence/locked counter, unique deed number, `under_review → registered`, write the deed into the deed database, decide whether to write back `ref.echallans.used_in_application_no`, append-only `audit_logs` (extend to Stage 2 events too).
7. Activate `application_status_rules` rows where `stage = 3`.
8. Admin: manage `fee_config`, `appointment_rules`, `public_holidays` (currently SQL-only).
9. Replace demo values with confirmed rules (fees, holidays, slots, entitlement, warish rule, name-match weights).
10. Certified copies (future), email/SMS notifications, rate limit for Stage 1 `/api/verify/*`.

## 9. First steps for the next developer (with network + Supabase)
1. `npm install && npm run build && npm run lint && npm test` — fix issues; record in PROJECT_STATUS.
2. SQL Editor: run 06 → 07 → 08 → 09; run `verify_rpc_security.sql` and `verify_stage2_security.sql`; compare with the expected comments.
3. Run the scenarios in `supabase/tests/stage2_manual_checks.sql` (A–C, then D with real ids, E for the correction UI).
4. Browser: user1 → "Apply for Deed" → complete all steps with dummy data → submit; check `/dashboard/applications`; try a second user using the same challan (must be refused); try selling more than remaining (must be blocked).
5. Never run `00_reset_data.sql`, `02_seed_all.sql`, CSV imports or `01_schema.sql`.
