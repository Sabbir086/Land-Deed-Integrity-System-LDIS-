# Final Test Report

Date: 2026-10-15  
Target: supplied `land-deed-system` source ZIP  
Environment: Node.js v22.16.0, npm 10.9.2; network access to npm registry unavailable.

## Command results
| Command/check | Result | Evidence / limitation |
|---|---|---|
| ZIP extraction and source inventory | PASS | Project extracted and source tree inspected. |
| `node -v` | PASS | `v22.16.0` |
| `npm -v` | PASS | `10.9.2` |
| `npm test` | PASS | 12 tests passed, 0 failed. Node emitted module-type performance warnings for ES-module source files. |
| `npm install --ignore-scripts --no-audit --no-fund --fetch-retries=0 --fetch-timeout=20000` | BLOCKED | `EAI_AGAIN registry.npmjs.org`; dependencies could not be installed. |
| `npm run lint` | BLOCKED / NOT RUN | `eslint: not found` because dependency installation failed. |
| `npm run build` | BLOCKED / NOT RUN | `next: not found` because dependency installation failed. |
| Secret/config source scan | PARTIAL PASS | `.env.example` contains only placeholders; no service-role key name/value was found in scanned source. This is not a substitute for full history/credential scanning. |
| Migration source review | PARTIAL PASS | Files 06–10 and key staff functions inspected; no SQL was executed. |
| Live Supabase RLS/auth matrix | NOT TESTED | No authorized staging credentials or database connection. |
| Live migration compatibility | NOT TESTED | Applied migration history unavailable. |
| GitHub upload | NOT PERFORMED | No repository remote/credentials. |
| Vercel Preview / production | NOT TESTED | No Vercel project/credentials; build could not be run. |

## Automated unit test details
`npm test` executed Node's built-in test runner over `tests/*.test.mjs`:
- Application input schema and validation tests.
- Rejection of client-supplied derived values.
- Application status and wizard navigation logic.
- Bangla/English digit normalization, similarity, identity match outcomes, remaining land calculation, unknown khas behavior, challan indicators, deed/history indicators.

Result: 12 passed, 0 failed. These are local unit tests. They are not live Supabase, RLS, end-to-end browser, or integration tests.

## Critical scenarios not proven
- Signup role cannot be escalated in the actual database trigger/RLS setup.
- User A cannot read/update User B's application or documents.
- Registrar A cannot read/change applications outside their district/upazila.
- Forged roles and unauthenticated direct RPC calls are rejected.
- Fee/challan matching, challan reuse, appointment/biometric status, final approval and duplicate finalization work against the actual database.
- Migration 06–10 compatibility with the current target database.
- Runtime compatibility, production build, deployment redirects, email confirmation, storage policies, and actual government/payment/biometric services.

## Conclusion
The project is **not proven production-ready**. Unit tests pass, but dependencies could not be installed, lint/build did not run, and live database/security/deployment tests remain outstanding. See `REMAINING_TASKS.md` for exact actions.
