# API Contracts

## Existing verification API (Stage 1)
POST `/api/verify/<name>`; signed-in session required; requests are validated server-side and call narrowly scoped verification RPCs. Routes include `locations`, `khatian-types`, `nid`, `khatian`, `owner-check`, `dag-history`, `khas`, `deed`, `warish`, and `challan`. See the Stage 1 handoff and route source for exact payload schemas.

## Application API (Stage 2)
POST `/api/applications/<action>`; user role and application ownership are enforced in the database RPC. `lib/applications/schemas.js` is the source of accepted action names and input schemas. Never send client-computed fee totals, ownership outcomes or status transitions as authoritative values.

## Staff API (Stage 3)
All require an authenticated session and staff profile. Every request body is untrusted; RPCs independently verify role and jurisdiction.

- `POST /api/staff/queue` body `{ "status": null | "submitted" | ... }`; invokes `staff_queue(p_status text)`.
- `POST /api/staff/detail` body `{ "application_id": "uuid" }`; invokes `staff_application_detail(p_app uuid)`.
- `POST /api/staff/decision` body `{ "application_id": "uuid", "decision": "start_review|request_correction|approve|reject|confirm_appointment|mark_biometric_completed|mark_biometric_failed", "note": "text", "steps": [1,2] }`; invokes `staff_decide_application`.
- `POST /api/staff/finalize` body `{ "application_id": "uuid" }`; invokes atomic `staff_finalize_registration`.
- `POST /api/staff/summary` body `{}`; admin only; invokes `admin_summary`.

Errors: 401 unauthenticated; 403 unauthorized role/jurisdiction; 409 workflow precondition conflict; 422 invalid input; 500 unexpected database/configuration error. Error text is intentionally generic for unexpected server failures.

## Data integrity notes
- The staff queue uses application `office_district` and `office_upazila`; confirm Stage 2 populates these fields before enabling real use.
- Fee and challan data are from the demo reference dataset; no live bank/payment provider is connected.
- The finalization function uses PostgreSQL transaction semantics, row locking and uniqueness constraints. It produces `DEMO-*` references only.
