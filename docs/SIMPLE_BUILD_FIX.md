# Simple Build Fix and Deployment Notes

## What changed

The protected dashboard and verification pages use Supabase cookies/session data. They must be rendered per request, not pre-rendered as static pages during `next build`.

The affected pages now declare:

```js
export const dynamic = "force-dynamic";
```

The sign-out route is also marked dynamic. This is a small Next.js configuration fix; it does not remove the existing land verification, application, challan, registrar, or admin features.

## Required Vercel settings

- Framework preset: **Next.js**
- Build command: `npm run build`
- Do not use `next export` or static-export hosting for this project. Login, Supabase sessions, API route handlers, and role-protected dashboards require a server runtime.
- Add these Vercel Environment Variables for Production (and Preview if needed):
  - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase Project URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon/publishable key
- Do not add a service-role key to frontend variables or commit secrets to GitHub.
- After changing settings/environment variables, redeploy.

## Local checks

```bash
npm install
npm test
npm run build
npm run start
```

`npm test` passed all 12 existing unit tests after this change. A production build could not be run in the editing environment because the Next.js dependencies were not installed and package-registry access was unavailable. Therefore, this ZIP is a targeted build-fix attempt, not a claim that a live Vercel deployment or Supabase integration has been verified.

## Scope

The existing Supabase schema and project workflow have been preserved. This change does not run migrations, change Supabase data, or claim that external government records, official fee calculations, biometric capture, or legal registration are connected.
