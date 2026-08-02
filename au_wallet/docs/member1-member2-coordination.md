# Member 1 and Member 2: Short Coordination Note

Member 2 can continue now with passport HMAC and mocked academic matching. We
do not need to change or wait for Member 1's current code for that work.

Before we connect the real onboarding API, we need to agree these points:

1. Apply Member 1's holder-account migration after adding permission for the
   holder-account ID sequence.
2. Confirm that a protected student request always gives Member 2 a trusted,
   non-null `holderAccountId`. The browser must never send this ID.
3. Confirm the backend-only access needed for academic reads and wallet
   onboarding writes, including custom-schema Data API exposure, grants, and
   the later RLS design.
4. Decide whether withdrawn or suspended applications are rejected or sent to
   issuer review. The public response will remain generic either way.
5. Agree how Member 2 approval asks Member 1 to activate the holder account so
   the two updates cannot silently disagree.
6. Agree the issuer/frontend CORS and test setup and remember that role changes
   require a refreshed session.

Passport document upload is optional for now. A student may complete automatic
matching without uploading a passport image or PDF. The passport identifier is
still required for the three-factor match and is HMACed only in the trusted
NestJS backend.

## Issuer frontend meeting checklist

The first onboarding form should send only:

- `admissionNo`
- `dateOfBirth` in `YYYY-MM-DD` form
- `passportNumber`

The frontend must not send `holderAccountId`, role, academic status, matched
enrollment ID, name, email, graduation date, or a passport document in this
request. Member 1's authentication context supplies holder ownership.

Please agree these frontend points:

1. Confirm the issuer UI origin and backend API base URL for CORS.
2. Send the Bearer access token from Member 1's login flow.
3. Never save or log the passport identifier in browser storage, analytics,
   error reporting, or console output.
4. Display only a verified result or the generic message: “We could not verify
   the submitted information automatically.”
5. Do not show which identity factor failed or expose an academic status.
6. Treat passport image/PDF upload as an optional, later manual-review action.
7. Agree loading, retry, expired-session, and manual-review screens before the
   real endpoint is connected.
