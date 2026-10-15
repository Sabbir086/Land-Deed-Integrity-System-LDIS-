# Land Deed Verification & Registration System — Integrated Stages 1–3

Next.js 14 App Router (JavaScript) · Supabase Auth/PostgreSQL · Tailwind CSS · Vercel. This is a **DEMO / prototype** using fictional reference data. It is not an official Bangladesh government system and does not produce a legally valid registration.

## What is included
- Stage 1: authentication, role-aware routing, secure reference lookup RPCs and verification pages.
- Stage 2: 9-step deed application wizard, server-side recomputation, fee/challan checks against demo reference records, private document metadata, appointment booking, tracking and notifications.
- Stage 3 additions: registrar queue/detail/decisions, jurisdiction-bound server RPCs, appointment/biometric status recording, admin statistics/registrar visibility/audit view, atomic DEMO registration register, append-only audit/registration tables, deployment/test documentation.

**Important baseline:** Stage 2 handoff says no SQL migrations had been applied and no real Supabase/browser/build test was run. Stage 3 is code-reviewed in this delivery environment but has not been validated against your live Supabase project. Do not describe it as production-ready.

**Lockfile note:** a `package-lock.json` could not be generated in this environment because npm registry metadata was unavailable and no cache was present. Generate and commit it in a network-enabled Node/npm environment with `npm install`, then use `npm ci` for reproducible builds.

## Requirements
- Node.js 18.18+ (Node 20 LTS recommended), npm
- Existing Supabase project containing the original `ref` schema and imported reference data, plus `public.profiles`.
- Do not run reset/seed scripts and do not re-import reference CSVs.

## Local setup
```bash
npm ci
cp .env.example .env.local
# Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```
Open `http://localhost:3000`. Use a test account whose profile role has been provisioned in Supabase. Do not add service-role keys to the frontend or this repository.

## Database deployment order
Before applying anything, inspect your actual database migration history and back up the project. Apply only missing migrations, in order:
1. `supabase/migrations/06_verification_rpcs.sql`
2. `supabase/migrations/07_application_tables.sql`
3. `supabase/migrations/08_application_logic.sql`
4. `supabase/migrations/09_application_rpcs.sql`
5. `supabase/migrations/10_stage3_registrar_admin.sql`

The first four files are from Stage 1/2 and are marked **not previously applied** in their handoff. Confirm against your actual Supabase project before running. `10` is additive to application tables, enables the documented Stage 3 transitions and does not modify or seed `ref.*`. SQL execution must be tested; a migration file existing in Git does not mean it was applied. Run the included security/manual checks after migrations. Do not run destructive/reset scripts.

## Roles
New signups always receive `user`. The signup form cannot promote a user. An authorized database administrator must provision `sub_registrar` and `admin` roles and registrar district/upazila in `public.profiles`. One registrar per upazila is enforced by the existing partial unique index. Admin role assignment is a privileged operational step; this app deliberately has no client-side role editor.

## Test and build
```bash
npm test
npm run lint
npm run build
```
Run `npm ci` first. Automated tests do not replace live RLS, concurrency, SQL migration, storage policy and browser tests. See `docs/FINAL_TEST_REPORT.md`.

## GitHub
```bash
git init
git add .
git status                 # confirm .env.local and secrets are NOT staged
git commit -m "Integrate land deed system stages 1-3"
git branch -M main
git remote add origin https://github.com/YOUR_ORG/YOUR_REPOSITORY.git
git push -u origin main
```

## Vercel
1. Import the GitHub repository into Vercel.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Development/Preview/Production environment scopes.
3. Deploy only after the database migrations are applied and tested in a non-production project first.
4. In Supabase Auth URL Configuration, set Site URL to the deployed origin and add exact callback/redirect URLs used by your deployment, local development and preview environments. Avoid broad wildcard redirects.
5. Check build logs, login/logout, email confirmation behavior, all role routes, RLS and staff jurisdiction checks after deployment.

## Honest limitations
- Registration references are `DEMO-...`; this is not an official government register.
- Biometric status is entered by authorized staff; there is no biometric capture device or identity service integration.
- NID, deeds, khatian, khas/govt and e-challan checks use only the project's reference data. No official government API or payment gateway is connected.
- Fee rates, ownership entitlement calculations, matching threshold, office hours and appointment rules remain demo/assumption-based until approved by the appropriate authority.
- Registrar assignment depends on application `office_district` and `office_upazila` fields. Confirm that the Stage 2 save workflow populates them accurately before testing staff queue.
- Admin panel provides monitoring and audit viewing; role assignment is not performed in the browser.
