# Remaining Tasks and Blockers

These are items that cannot honestly be marked complete from the supplied source ZIP alone.

## Required before a Preview deployment
1. Restore npm registry/network access and run `npm install` from the project root. Commit the resulting `package-lock.json` after reviewing it; then verify clean installation with `npm ci`.
2. Run `npm run lint` and `npm run build`; fix any errors that those checks reveal.
3. Configure Preview environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or the project's Supabase publishable key compatible with the client).
4. Use a separate staging Supabase project. Confirm the migration history and apply only migrations proven missing, in dependency order.
5. Run RLS/authorization tests with at least two ordinary users, two registrars in different jurisdictions, and an admin. Include cross-user application IDs, cross-jurisdiction IDs, forged request roles, and unauthenticated RPC calls.
6. Verify all test applications have correct `office_district` and `office_upazila`; test missing and mismatched routing.
7. Review the role policy: migration 10 allows `admin` and `sub_registrar` to call staff decision/finalization RPCs, while `admin_summary` is admin-only. Confirm that this is intended.
8. Inspect Supabase Storage bucket policies and private document access; source metadata visibility alone is not proof that file downloads are protected.

## Required before production
1. Obtain approval and authoritative specifications for official fees, government systems, payment/challan services, legal process, and biometric capture. Until then, retain explicit DEMO labels and do not use real legal-registration claims.
2. Test backups, monitoring, error alerts, incident response, and rollback procedures.
3. Set exact Supabase Auth Site URL and redirect allow-list for local, Preview, and production origins.
4. Perform a human security review of SQL `SECURITY DEFINER` functions, grants, policies, data minimization, audit retention, and rate limiting.
5. Test production build and complete role matrix in Preview before promoting to production.

## Not performed
- No Supabase connection or live SQL execution.
- No GitHub upload or push.
- No Vercel import, Preview deployment, or production deployment.
- No real government, payment, or biometric integration tests.
