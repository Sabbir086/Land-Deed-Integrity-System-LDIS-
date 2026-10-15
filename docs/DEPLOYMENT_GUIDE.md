# Deployment Guide — GitHub, Supabase, Vercel

This project is a Next.js 14 App Router demo. Do not deploy to production until the blockers in `REMAINING_TASKS.md` are resolved.

## 1. Prerequisites and local validation
- Node.js `>=18.18` (Node 20 LTS is a reasonable deployment baseline).
- npm 10-compatible environment.
- Network access to npm registry.
- A Supabase staging project and test accounts.

From the project root:
```bash
npm install
npm test
npm run lint
npm run build
npm start
```
After `package-lock.json` is generated and reviewed, use `npm ci` for reproducible clean installs. This ZIP did not include a lockfile; registry DNS failed during this review, so no lockfile was fabricated. `npm test` passed 12 tests; lint/build could not run because dependencies were absent.

## 2. Environment variables
Copy `.env.example` to `.env.local` for local development. Set:
- `NEXT_PUBLIC_SUPABASE_URL`: project URL from Supabase API settings.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: anon/public publishable key for that same project.

These values are intended for client configuration; access control must come from Auth, RLS and server-side RPC checks. Never use a service-role key, database password, JWT secret, or private credential in `NEXT_PUBLIC_*`, source control, or client code. Set the same public values separately for Vercel Preview and Production, pointing to the appropriate Supabase project.

## 3. Supabase migration and Auth configuration
1. Read `DATABASE_MIGRATIONS.md`. Confirm actual applied migration history first.
2. Back up the database and test in staging. Apply only approved migrations known to be missing, in order 06 → 07 → 08 → 09 → 10.
3. Preserve existing `ref.*` tables and reference data. Never run reset/seed commands against production.
4. Review Supabase Auth → URL Configuration. Set the Site URL to the intended deployed origin and add exact local/Preview/production callback URLs actually used by the app. Do not use broad wildcard redirects unless specifically justified.
5. Provision `sub_registrar` and `admin` roles through a controlled privileged database process. Signup must not assign these roles.
6. Confirm registrar district/upazila and application office district/upazila are correct.
7. Run the provided SQL verification scripts and staging tests. The SQL files alone do not prove security.

## 4. Private GitHub repository
1. Create a private repository on GitHub.
2. From the project root, inspect `git status` and scan for secrets before adding files.
3. Run `git init` only if the project is not already a repository, then:
```bash
git add .
git status --short
git diff --cached --stat
git commit -m "Prepare land deed demo for deployment"
git branch -M main
git remote add origin https://github.com/YOUR_ORG/YOUR_REPOSITORY.git
git push -u origin main
```
Replace the placeholder remote with your actual private repository URL. Do not commit `.env.local`, credentials, exports of private data, `node_modules`, `.next`, or `.vercel`. No GitHub upload was performed during this review.

## 5. Vercel Preview
1. Import the private GitHub repository into Vercel.
2. Confirm Vercel detects Next.js. Leave the standard Next.js build settings unless the detected project settings indicate otherwise.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` under Preview environment variables, scoped to the staging project.
4. Deploy a Preview and inspect build logs. Verify page refresh/deep links, signup/login/logout, email confirmation, protected routes, user ownership, registrar jurisdiction, admin-only summary, document access, and failure states.
5. Complete the full test matrix in `FINAL_TEST_REPORT.md`. Do not use production data for destructive tests.

## 6. Production promotion checklist
- [ ] Dependencies install cleanly with `npm ci`.
- [ ] Tests, lint and production build pass.
- [ ] Staging RLS/role matrix passes.
- [ ] Approved migrations are applied and recorded.
- [ ] Auth redirects and email settings are verified.
- [ ] Backup, monitoring, rollback and incident contacts are in place.
- [ ] Official integrations and legal authority are independently confirmed, or the application remains a clearly labeled demo.
- [ ] All DEMO references are visibly identified as non-government and not legally valid registrations.

No GitHub push, Supabase migration, Vercel Preview, or production deployment was performed by this review.
