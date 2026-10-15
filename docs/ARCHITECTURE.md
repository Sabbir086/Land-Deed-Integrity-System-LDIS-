# Architecture

## Stack
Next.js 14 App Router, React 18, JavaScript, Tailwind CSS, Supabase Auth/PostgreSQL, `@supabase/ssr`, Vercel.

## Request paths
- Browser → Next.js route handler → Supabase client bound to the user's session → authorized RPC.
- Reference data access goes only through limited `SECURITY DEFINER` verification RPCs. The `ref` schema is not exposed directly.
- Stage 2 application writes use public `app_*` RPCs; server-side database logic recomputes derived fields and validates application ownership.
- Stage 3 staff endpoints verify the authenticated user and profile role in the route handler, then call RPCs that repeat role and jurisdiction checks in PostgreSQL.
- Final registration uses a single database function and transaction: lock application, validate state/preconditions, create unique register row, transition status, write status history and audit log. Any exception rolls the transaction back.

## Roles
- `user`: own applications, documents and notifications.
- `sub_registrar`: review applications assigned to matching district/upazila only.
- `admin`: summary, all application queue/details, registrar visibility and audit view. Role changes remain privileged database administration.

## Main directories
- `app/`: pages and route handlers.
- `components/verify/`: reference lookup UI.
- `components/applications/`: application wizard and tracking.
- `components/staff/`: registrar decision controls.
- `lib/`: auth, Supabase SSR, verification and application helpers.
- `supabase/migrations/`: ordered SQL migrations 06–10.
- `supabase/tests/`: SQL/manual checks.
- `docs/`: handoffs, contracts, deployment and test reports.

## Important caveat
This architecture is intended to enforce authorization at the database layer, but SQL has not been executed against the target Supabase project in this environment. Treat migration 10 as pending until manually applied and verified. Run a security review and test actual function ownership/search paths/grants on the deployed database.
